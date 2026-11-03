ObjC.import('AppKit');
ObjC.import('Foundation');

function ns(value) { return $(value); }
function image(path) { return $.NSImage.alloc.initWithContentsOfFile(ns(path)); }
function png(imageValue, destination) {
  const data = imageValue.TIFFRepresentation;
  const bitmap = $.NSBitmapImageRep.imageRepWithData(data);
  bitmap.representationUsingTypeProperties($.NSPNGFileType, $({})).writeToFileAtomically(ns(destination), true);
}
function composite(sourcePath, logoPath, outputPath, canvasWidth, canvasHeight, badgeRect, logoRect) {
  const source = image(sourcePath);
  const logo = image(logoPath);
  const output = $.NSImage.alloc.initWithSize($.NSMakeSize(canvasWidth, canvasHeight));
  output.lockFocus();
  source.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, canvasWidth, canvasHeight), $.NSMakeRect(0, 0, canvasWidth, canvasHeight), $.NSCompositingOperationSourceOver, 1);
  $.NSColor.colorWithCalibratedRedGreenBlueAlpha(0.96, 0.92, 0.86, 1).setFill();
  $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius(badgeRect, 8, 8).fill();
  logo.drawInRectFromRectOperationFraction(logoRect, $.NSMakeRect(0, 0, logo.size.width, logo.size.height), $.NSCompositingOperationSourceOver, 1);
  output.unlockFocus();
  png(output, outputPath);
}

const root = $.NSFileManager.defaultManager.currentDirectoryPath.js + '/creative/meta-ads/';
const logoPath = root + '../../logo.png';
composite(root + 'nia-humanized-feed-source.png', logoPath, root + 'nia-hyderabad-meta-feed-ad-humanized.png', 1122, 1402, $.NSMakeRect(48, 1170, 420, 170), $.NSMakeRect(70, 1191, 376, 132));
composite(root + 'nia-hyderabad-reel-cover.png', logoPath, root + 'nia-hyderabad-reel-cover-humanized.png', 941, 1672, $.NSMakeRect(38, 1428, 410, 170), $.NSMakeRect(58, 1450, 370, 130));
