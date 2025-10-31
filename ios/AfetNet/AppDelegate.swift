import Expo
import ExpoModulesCore
import UIKit

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  // Window property with lazy initialization
  // This ensures window exists when Expo Dev Launcher needs it,
  // but doesn't interfere with ExpoAppDelegate's initialization sequence
  private var _window: UIWindow?
  public override var window: UIWindow? {
    get {
      if _window == nil {
        _window = UIWindow(frame: UIScreen.main.bounds)
        _window?.rootViewController = UIViewController()
      }
      return _window
    }
    set {
      _window = newValue
    }
  }
  
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Let ExpoAppDelegate handle complete initialization sequence:
    // 1. autoSetupPrepare (creates ReactDelegate)
    // 2. autoSetupStart (accesses window property via lazy getter)
    // Window will be created lazily when Expo Dev Launcher accesses it
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    
    // After Expo setup completes, ensure window is key and visible
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