import Foundation
import AppKit
import AVFoundation
import CoreVideo

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("creative/meta-ads")
let feedBackground = NSImage(contentsOf: root.appendingPathComponent("nia-hyderabad-feed-background.png"))!
let reelBackground = NSImage(contentsOf: root.appendingPathComponent("nia-hyderabad-reel-background.png"))!
let navy = NSColor(calibratedRed: 0.024, green: 0.11, blue: 0.25, alpha: 1)
let orange = NSColor(calibratedRed: 0.91, green: 0.51, blue: 0.18, alpha: 1)
let ivory = NSColor(calibratedRed: 0.965, green: 0.92, blue: 0.86, alpha: 1)

func text(_ value: String, at point: NSPoint, font: NSFont, color: NSColor, tracking: CGFloat = 0, alpha: CGFloat = 1) {
  let paragraph = NSMutableParagraphStyle(); paragraph.lineBreakMode = .byWordWrapping
  let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color.withAlphaComponent(alpha), .kern: tracking, .paragraphStyle: paragraph]
  NSAttributedString(string: value, attributes: attrs).draw(at: point)
}

func fade(_ time: Double, _ start: Double, _ duration: Double = 0.45) -> CGFloat {
  if time < start { return 0 }
  return CGFloat(min(1, (time - start) / duration))
}

func drawCover(_ source: NSImage, into rect: NSRect) {
  let sourceSize = source.size
  let scale = max(rect.width / sourceSize.width, rect.height / sourceSize.height)
  let size = NSSize(width: sourceSize.width * scale, height: sourceSize.height * scale)
  let target = NSRect(x: rect.midX - size.width / 2, y: rect.midY - size.height / 2, width: size.width, height: size.height)
  source.draw(in: target, from: NSRect(origin: .zero, size: sourceSize), operation: .sourceOver, fraction: 1)
}

func gradient(_ rect: NSRect, top: NSColor, bottom: NSColor) {
  NSGradient(starting: top, ending: bottom)?.draw(in: rect, angle: -90)
}

func poster(size: NSSize, story: Bool) -> NSImage {
  let image = NSImage(size: size)
  image.lockFocus()
  let bounds = NSRect(origin: .zero, size: size)
  drawCover(story ? reelBackground : feedBackground, into: bounds)
  gradient(bounds, top: navy.withAlphaComponent(0.88), bottom: navy.withAlphaComponent(0.18))
  NSColor(navy.withAlphaComponent(0.52)).setFill(); NSBezierPath(rect: NSRect(x: 0, y: 0, width: size.width, height: story ? 620 : 470)).fill()
  NSColor(orange).setFill(); NSBezierPath(rect: NSRect(x: 72, y: size.height - 170, width: 92, height: 7)).fill()
  text("NETWORK IN ACTION · HYDERABAD", at: NSPoint(x: 72, y: size.height - 140), font: .systemFont(ofSize: 22, weight: .bold), color: ivory, tracking: 4)
  let headlineY = size.height - 285
  text(story ? "Connect." : "More than", at: NSPoint(x: 72, y: headlineY), font: .systemFont(ofSize: 70, weight: .bold), color: .white)
  text(story ? "Collaborate." : "networking.", at: NSPoint(x: 72, y: headlineY - 82), font: .systemFont(ofSize: 70, weight: .bold), color: .white)
  text(story ? "Grow." : "A growth engine.", at: NSPoint(x: 72, y: headlineY - 164), font: .systemFont(ofSize: 70, weight: .bold), color: orange)
  let footerY: CGFloat = story ? 240 : 210
  gradient(NSRect(x: 0, y: 0, width: size.width, height: footerY + 250), top: navy.withAlphaComponent(0.93), bottom: navy.withAlphaComponent(0.15))
  text(story ? "Experience NIA as a guest." : "Meet ambitious Hyderabad business owners.", at: NSPoint(x: 72, y: footerY + 175), font: .systemFont(ofSize: 27, weight: .medium), color: ivory)
  text("GUEST MEETING · 11 NOVEMBER 2026", at: NSPoint(x: 72, y: footerY + 122), font: .systemFont(ofSize: 28, weight: .bold), color: .white)
  text("6:00–9:00 PM · NOVOTEL HICC HYDERABAD", at: NSPoint(x: 72, y: footerY + 80), font: .systemFont(ofSize: 24, weight: .semibold), color: .white)
  text("₹2,600 · taxes & dinner included", at: NSPoint(x: 72, y: footerY + 42), font: .systemFont(ofSize: 24, weight: .regular), color: ivory)
  NSColor(orange).setFill(); NSBezierPath(roundedRect: NSRect(x: 72, y: footerY - 58, width: 570, height: 76), xRadius: 4, yRadius: 4).fill()
  text("EXPLORE A GUEST MEETING  →", at: NSPoint(x: 104, y: footerY - 34), font: .systemFont(ofSize: 27, weight: .bold), color: navy)
  text("hyderabad.networkinaction.info", at: NSPoint(x: 72, y: 34), font: .systemFont(ofSize: 20, weight: .medium), color: ivory)
  image.unlockFocus(); return image
}

func png(_ image: NSImage, _ name: String) {
  let data = image.tiffRepresentation!
  let rep = NSBitmapImageRep(data: data)!
  try! rep.representation(using: .png, properties: [:])!.write(to: root.appendingPathComponent(name))
}

func reelFrame(_ t: Double, size: NSSize) -> NSImage {
  let image = NSImage(size: size); image.lockFocus()
  let bounds = NSRect(origin: .zero, size: size)
  let zoom = 1.0 + CGFloat(t) * 0.012
  let sourceSize = reelBackground.size
  let scale = max(size.width / sourceSize.width, size.height / sourceSize.height) * zoom
  let rendered = NSSize(width: sourceSize.width * scale, height: sourceSize.height * scale)
  let pan = CGFloat(t) * 8
  reelBackground.draw(in: NSRect(x: (size.width-rendered.width)/2 - pan, y: (size.height-rendered.height)/2, width: rendered.width, height: rendered.height), from: NSRect(origin: .zero, size: sourceSize), operation: .sourceOver, fraction: 1)
  gradient(bounds, top: navy.withAlphaComponent(0.92), bottom: navy.withAlphaComponent(0.68))
  let h: CGFloat = size.height
  let labelAlpha = fade(t, 0)
  NSColor(orange).withAlphaComponent(labelAlpha).setFill(); NSBezierPath(rect: NSRect(x: 72, y: h-160, width: 88, height: 7)).fill()
  text("NETWORK IN ACTION · HYDERABAD", at: NSPoint(x: 72, y: h-130), font: .systemFont(ofSize: 20, weight: .bold), color: ivory, tracking: 3.5, alpha: labelAlpha)
  if t < 3.3 {
    let a = fade(t, 0.4)
    text("More than", at: NSPoint(x: 72, y: h-320), font: .systemFont(ofSize: 75, weight: .bold), color: .white, alpha: a)
    text("networking.", at: NSPoint(x: 72, y: h-407), font: .systemFont(ofSize: 75, weight: .bold), color: .white, alpha: a)
  } else if t < 6.4 {
    let a = fade(t, 3.4)
    text("A growth", at: NSPoint(x: 72, y: h-320), font: .systemFont(ofSize: 75, weight: .bold), color: orange, alpha: a)
    text("engine.", at: NSPoint(x: 72, y: h-407), font: .systemFont(ofSize: 75, weight: .bold), color: orange, alpha: a)
    text("Connect. Collaborate. Grow.", at: NSPoint(x: 72, y: h-468), font: .systemFont(ofSize: 30, weight: .medium), color: ivory, alpha: a)
  } else {
    let a = fade(t, 6.5)
    text("Your next", at: NSPoint(x: 72, y: h-320), font: .systemFont(ofSize: 72, weight: .bold), color: .white, alpha: a)
    text("conversation", at: NSPoint(x: 72, y: h-402), font: .systemFont(ofSize: 72, weight: .bold), color: .white, alpha: a)
    text("starts here.", at: NSPoint(x: 72, y: h-484), font: .systemFont(ofSize: 72, weight: .bold), color: orange, alpha: a)
  }
  let a = fade(t, 6.7)
  NSColor(navy).withAlphaComponent(a * 0.87).setFill(); NSBezierPath(rect: NSRect(x: 0, y: 0, width: size.width, height: 480)).fill()
  text("11 NOVEMBER 2026 · 6:00–9:00 PM", at: NSPoint(x: 72, y: 304), font: .systemFont(ofSize: 29, weight: .bold), color: .white, alpha: a)
  text("NOVOTEL HICC HYDERABAD", at: NSPoint(x: 72, y: 258), font: .systemFont(ofSize: 27, weight: .semibold), color: ivory, alpha: a)
  text("₹2,600 · taxes & dinner included", at: NSPoint(x: 72, y: 216), font: .systemFont(ofSize: 26, weight: .regular), color: ivory, alpha: a)
  NSColor(orange).withAlphaComponent(a).setFill(); NSBezierPath(roundedRect: NSRect(x: 72, y: 105, width: 580, height: 82), xRadius: 4, yRadius: 4).fill()
  text("EXPLORE A GUEST MEETING  →", at: NSPoint(x: 105, y: 133), font: .systemFont(ofSize: 27, weight: .bold), color: navy, alpha: a)
  text("hyderabad.networkinaction.info", at: NSPoint(x: 72, y: 56), font: .systemFont(ofSize: 20, weight: .medium), color: ivory, alpha: a)
  image.unlockFocus(); return image
}

func pixelBuffer(from image: NSImage, pool: CVPixelBufferPool) -> CVPixelBuffer {
  var buffer: CVPixelBuffer?; CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
  let result = buffer!; CVPixelBufferLockBaseAddress(result, [])
  let context = CGContext(data: CVPixelBufferGetBaseAddress(result), width: Int(image.size.width), height: Int(image.size.height), bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(result), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
  context.translateBy(x: 0, y: image.size.height); context.scaleBy(x: 1, y: -1)
  context.draw(image.cgImage(forProposedRect: nil, context: nil, hints: nil)!, in: NSRect(origin: .zero, size: image.size))
  CVPixelBufferUnlockBaseAddress(result, []); return result
}

png(poster(size: NSSize(width: 1080, height: 1350), story: false), "nia-hyderabad-feed-poster.png")
png(poster(size: NSSize(width: 1080, height: 1920), story: true), "nia-hyderabad-story-poster.png")

let output = root.appendingPathComponent("nia-hyderabad-guest-meeting-reel.mp4")
try? FileManager.default.removeItem(at: output)
let writer = try! AVAssetWriter(outputURL: output, fileType: .mp4)
let settings: [String: Any] = [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: 1080, AVVideoHeightKey: 1920]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings); input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: 1080, kCVPixelBufferHeightKey as String: 1920])
writer.add(input); writer.startWriting(); writer.startSession(atSourceTime: .zero)
for frame in 0..<300 { autoreleasepool { while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }; let t = Double(frame) / 30.0; let buffer = pixelBuffer(from: reelFrame(t, size: NSSize(width: 1080, height: 1920)), pool: adaptor.pixelBufferPool!); adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: 30)) } }
input.markAsFinished(); let semaphore = DispatchSemaphore(value: 0); writer.finishWriting { semaphore.signal() }; semaphore.wait()
print("Rendered NIA posters and reel")
