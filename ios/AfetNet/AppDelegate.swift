import Expo
import ExpoModulesCore
import UIKit

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  // Window property - ExpoAppDelegate will manage it internally
  // We only declare it so UIApplication.shared.delegate?.window works
  public var window: UIWindow?
  
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // CRITICAL: Let ExpoAppDelegate handle complete initialization FIRST
    // This ensures autoSetupPrepare is called before autoSetupStart
    // ExpoAppDelegate will create and configure window internally
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    
    // After Expo setup completes (autoSetupPrepare and autoSetupStart have finished),
    // ensure window exists and is key/visible
    // ExpoAppDelegate may have created window, but if not, create it
    if self.window == nil {
      self.window = UIWindow(frame: UIScreen.main.bounds)
    }
    self.window?.makeKeyAndVisible()
    
    return result
  }

  // Linking API methods - preserve for deep linking support
  public override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return super.application(app, open: url, options: options)
  }

  public override func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler)
  }
}