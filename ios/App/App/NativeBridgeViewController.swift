import Capacitor
import UIKit

class NativeBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativePrintPlugin())
    }
}

@objc(NativePrintPlugin)
public class NativePrintPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativePrintPlugin"
    public let jsName = "NativePrint"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise)
    ]

    @objc func print(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let webView = self?.bridge?.webView,
                  let presenter = self?.bridge?.viewController,
                  presenter.presentedViewController == nil,
                  UIPrintInteractionController.isPrintingAvailable else {
                call.reject("Printing is not available right now.")
                return
            }
            let controller = UIPrintInteractionController.shared
            let info = UIPrintInfo(dictionary: nil)
            info.jobName = "Ellie's Book report"
            info.outputType = .general
            controller.printInfo = info
            controller.printFormatter = webView.viewPrintFormatter()
            let presented = controller.present(from: presenter.view.bounds, in: presenter.view, animated: true) { _, _, error in
                if let error = error {
                    call.reject("Could not print the report.", nil, error)
                } else {
                    call.resolve()
                }
            }
            if !presented {
                call.reject("Could not open print preview.")
            }
        }
    }
}
