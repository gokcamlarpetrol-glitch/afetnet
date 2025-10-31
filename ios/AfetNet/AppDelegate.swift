import Expo
import ExpoModulesCore
import UIKit

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  // Window property required by Expo Dev Launcher
  // Created before super call so it exists when Expo Dev Launcher accesses it
  // But NOT made key/visible until after Expo initialization completes
  public var window: UIWindow?
  
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Create window BEFORE super call so Expo Dev Launcher can access it
    // But do NOT call makeKeyAndVisible() yet - this preserves Expo's initialization order
    // ExpoAppDelegate will call:
    // 1. autoSetupPrepare (creates ReactDelegate)
    // 2. autoSetupStart (uses window) - requires window to exist
    // Do NOT set rootViewController - let Expo handle that
    if self.window == nil {
      self.window = UIWindow(frame: UIScreen.main.bounds)
    }
    
    // Let ExpoAppDelegate handle complete initialization sequence
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    
    // After Expo setup completes (autoSetupPrepare and autoSetupStart), make window key and visible
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