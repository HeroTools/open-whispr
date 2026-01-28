import Cocoa
import Foundation
import Darwin

let TIMEOUT_SECONDS: Double = 30.0
let MAX_OUTPUT_BYTES = 10240

var monitoredElement: AXUIElement?
var observer: AXObserver?
var monitoredPid: pid_t = 0

func writeOutput(_ message: String) {
    let truncated = String(message.prefix(MAX_OUTPUT_BYTES))
    FileHandle.standardOutput.write((truncated + "\n").data(using: .utf8)!)
    fflush(stdout)
}

func writeError(_ message: String) {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
}

func readCurrentValue() -> String? {
    guard let element = monitoredElement else { return nil }
    var value: AnyObject?
    let result = AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value)
    guard result == .success, let str = value as? String else { return nil }
    return str
}

func observerCallback(
    _ observer: AXObserver,
    _ element: AXUIElement,
    _ notification: CFString,
    _ refcon: UnsafeMutableRawPointer?
) {
    if let value = readCurrentValue() {
        writeOutput("CHANGED:\(value)")
    }
}

// Read original text from stdin (not used by the binary itself, but available for protocol)
var originalText = ""
if let line = readLine(strippingNewline: true) {
    originalText = line
}

// Use the system-wide element to find the globally focused element.
// This works regardless of which app macOS considers "frontmost",
// which matters because OpenWhispr's overlay window can confuse
// NSWorkspace.frontmostApplication.
let systemWide = AXUIElementCreateSystemWide()
let maxRetries = 5
var focusedElement: AXUIElement? = nil

for attempt in 1...maxRetries {
    var focusedValue: AnyObject?
    let focusResult = AXUIElementCopyAttributeValue(
        systemWide,
        kAXFocusedApplicationAttribute as CFString,
        &focusedValue
    )

    if focusResult == .success, let focusedApp = focusedValue {
        // Now get the focused element within that application
        var elementValue: AnyObject?
        let elementResult = AXUIElementCopyAttributeValue(
            focusedApp as! AXUIElement,
            kAXFocusedUIElementAttribute as CFString,
            &elementValue
        )

        if elementResult == .success, let element = elementValue {
            focusedElement = (element as! AXUIElement)

            // Get the PID from the focused application element
            var extractedPid: pid_t = 0
            AXUIElementGetPid(focusedApp as! AXUIElement, &extractedPid)
            monitoredPid = extractedPid

            if attempt > 1 {
                writeError("Got focused element on attempt \(attempt)")
            }
            break
        } else {
            writeError("Attempt \(attempt)/\(maxRetries): Got app but no focused element (error: \(elementResult.rawValue))")
        }
    } else {
        writeError("Attempt \(attempt)/\(maxRetries): Cannot get focused application (error: \(focusResult.rawValue))")
    }

    if attempt < maxRetries {
        Thread.sleep(forTimeInterval: 0.3)
    }
}

guard let resolvedElement = focusedElement, monitoredPid != 0 else {
    writeOutput("NO_ELEMENT")
    exit(1)
}

monitoredElement = resolvedElement
writeError("Monitoring element in PID \(monitoredPid)")

// Read initial value
guard let initialValue = readCurrentValue() else {
    writeError("Focused element has no text value")
    writeOutput("NO_VALUE")
    exit(0)
}

writeOutput("INITIAL_VALUE:\(initialValue)")

// Create AXObserver for the target application's PID
var createdObserver: AXObserver?
let observerResult = AXObserverCreate(monitoredPid, observerCallback, &createdObserver)

guard observerResult == .success, let obs = createdObserver else {
    writeError("Failed to create AXObserver (error: \(observerResult.rawValue))")
    exit(1)
}

observer = obs

// Watch for value changes
let addResult = AXObserverAddNotification(
    obs,
    monitoredElement!,
    kAXValueChangedNotification as CFString,
    nil
)

if addResult != .success {
    writeError("Failed to add notification (error: \(addResult.rawValue))")
    exit(1)
}

// Add observer to run loop
CFRunLoopAddSource(
    CFRunLoopGetCurrent(),
    AXObserverGetRunLoopSource(obs),
    .commonModes
)

// Schedule auto-exit after timeout
DispatchQueue.main.asyncAfter(deadline: .now() + TIMEOUT_SECONDS) {
    CFRunLoopStop(CFRunLoopGetCurrent())
}

// Handle SIGTERM for clean exit
let signalSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
signal(SIGTERM, SIG_IGN)
signalSource.setEventHandler {
    CFRunLoopStop(CFRunLoopGetCurrent())
}
signalSource.resume()

CFRunLoopRun()
