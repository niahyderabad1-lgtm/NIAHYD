#!/usr/bin/env python3
"""Verify the supplied MySQL backup and prepare a private PostgreSQL staging import.

The generated SQL contains personal data. Keep it outside the repository and do not
share it. The summary JSON contains counts only.
"""
import argparse
import collections
import gzip
import hashlib
import json
import os
import re
from pathlib import Path


EXPECTED_TABLES = {
    'crm_basic_online_check_runs': 1,
    'crm_basic_online_checks': 1,
    'crm_basic_online_evidence': 0,
    'crm_callback_reminders': 493,
    'crm_groups': 7,
    'crm_import_summaries': 1,
    'crm_in_app_notifications': 67,
    'crm_lead_changes': 756,
    'crm_leads': 1152,
    'crm_saved_ledger_filters': 0,
    'crm_whatsapp_preferences': 1,
    'crm_whatsapp_templates': 1,
    'users': 3,
}


def parse_row(raw):
    """Parse one mysqldump VALUES row, including quoted commas and escapes."""
    assert raw.startswith('(') and raw.endswith(('),', ');'))
    raw = raw[1:-2]
    values = []
    pos = 0
    escape = {'0': '\0', 'b': '\b', 'n': '\n', 'r': '\r', 't': '\t', 'Z': '\x1a'}
    while pos < len(raw):
        while pos < len(raw) and raw[pos].isspace():
            pos += 1
        if pos < len(raw) and raw[pos] == "'":
            pos += 1
            parts = []
            while pos < len(raw):
                char = raw[pos]
                if char == '\\':
                    pos += 1
                    if pos >= len(raw):
                        raise ValueError('Incomplete MySQL escape')
                    parts.append(escape.get(raw[pos], raw[pos]))
                    pos += 1
                elif char == "'":
                    if pos + 1 < len(raw) and raw[pos + 1] == "'":
                        parts.append("'")
                        pos += 2
                    else:
                        pos += 1
                        break
                else:
                    parts.append(char)
                    pos += 1
            else:
                raise ValueError('Unterminated MySQL string')
            values.append(''.join(parts))
        else:
            end = raw.find(',', pos)
            if end < 0:
                end = len(raw)
            value = raw[pos:end].strip()
            if value == 'NULL':
                values.append(None)
            elif re.fullmatch(r'-?\d+', value):
                values.append(int(value))
            elif re.fullmatch(r'-?\d+\.\d+', value):
                values.append(float(value))
            else:
                raise ValueError('Unexpected MySQL literal')
            pos = end
        while pos < len(raw) and raw[pos].isspace():
            pos += 1
        if pos < len(raw):
            if raw[pos] != ',':
                raise ValueError('Expected a value separator')
            pos += 1
    return values


def read_backup(path):
    tables = collections.defaultdict(list)
    columns = {}
    current = None
    with gzip.open(path, 'rt', encoding='utf-8', newline='') as stream:
        for line_number, line in enumerate(stream, 1):
            match = re.match(r'INSERT INTO `([^`]+)` \((.*)\) VALUES\s*$', line)
            if match:
                current = match.group(1)
                columns[current] = re.findall(r'`([^`]+)`', match.group(2))
                continue
            if current and line.startswith('('):
                final = line.rstrip().endswith(');')
                values = parse_row(line.rstrip())
                if len(values) != len(columns[current]):
                    raise ValueError(f'Column count mismatch at line {line_number}')
                tables[current].append(dict(zip(columns[current], values)))
                if final:
                    current = None
    return tables


def normalized_phone(value):
    digits = re.sub(r'\D', '', str(value or ''))
    return '91' + digits if len(digits) == 10 else digits


def summary(tables, digest):
    leads = tables['crm_leads']
    phones = collections.Counter(normalized_phone(row.get('phone')) for row in leads if normalized_phone(row.get('phone')))
    emails = collections.Counter(str(row.get('email') or '').strip().lower() for row in leads if row.get('email'))
    local_candidates = sum(
        bool(row.get('name') and re.fullmatch(r'[0-9]{10,15}', normalized_phone(row.get('phone'))))
        and str(row.get('groupId')) != '30001'
        and phones[normalized_phone(row.get('phone'))] == 1
        and (not row.get('email') or emails[str(row.get('email')).strip().lower()] == 1)
        for row in leads
    )
    return {
        'backup_sha256': digest,
        'table_counts': {name: len(tables[name]) for name in EXPECTED_TABLES},
        'lead_status_counts': dict(collections.Counter(row.get('leadStatus') or '<blank>' for row in leads)),
        'lead_group_counts': dict(collections.Counter(str(row.get('groupId') or '<blank>') for row in leads)),
        'leads_missing_phone': sum(not row.get('phone') for row in leads),
        'leads_missing_company': sum(not row.get('company') for row in leads),
        'repeated_phone_rows': sum(count - 1 for count in phones.values() if count > 1),
        'repeated_email_rows': sum(count - 1 for count in emails.values() if count > 1),
        'valid_for_current_lead_model': sum(bool(row.get('name') and re.fullmatch(r'[0-9]{10,15}', normalized_phone(row.get('phone')))) for row in leads),
        'validation_group_rows_archived_only': sum(str(row.get('groupId')) == '30001' for row in leads),
        'locally_unique_candidates_before_live_match': local_candidates,
        'marketing_consent_in_backup': False,
        'live_rows_modified': False,
    }


def sql_literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def generate_sql(path, tables, digest):
    with path.open('w', encoding='utf-8') as output:
        os.chmod(path, 0o600)
        output.write('-- Confidential legacy data. Import only into the private legacy_hub schema.\n')
        output.write('begin;\nset local standard_conforming_strings = on;\n')
        for name in EXPECTED_TABLES:
            for row in tables[name]:
                source_id = row.get('id', row.get('userId'))
                if source_id is None:
                    raise ValueError(f'Missing primary key in {name}')
                payload = json.dumps(row, ensure_ascii=True, separators=(',', ':'))
                output.write('insert into legacy_hub.records(backup_sha256,source_table,source_id,payload) values ('
                             + ','.join(map(sql_literal, (digest, name, source_id, payload)))
                             + '::jsonb) on conflict do nothing;\n')
        output.write('commit;\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('backup', type=Path)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--expected-sha256')
    args = parser.parse_args()
    hasher = hashlib.sha256()
    with args.backup.open('rb') as backup_stream:
        for chunk in iter(lambda: backup_stream.read(1024 * 1024), b''):
            hasher.update(chunk)
    digest = hasher.hexdigest()
    if args.expected_sha256 and digest != args.expected_sha256:
        raise SystemExit('Backup checksum does not match; import cancelled.')
    tables = read_backup(args.backup)
    counts = {name: len(tables[name]) for name in EXPECTED_TABLES}
    if counts != EXPECTED_TABLES:
        raise SystemExit(f'Unexpected table counts: {counts}')
    args.output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(args.output_dir, 0o700)
    report = summary(tables, digest)
    report_path = args.output_dir / 'legacy-import-preview.json'
    report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    data_path = args.output_dir / 'legacy-hub-data.sql'
    generate_sql(data_path, tables, digest)
    print(json.dumps({'summary': str(report_path), 'confidential_sql': str(data_path), 'counts': counts, 'live_rows_modified': False}))


if __name__ == '__main__':
    main()
