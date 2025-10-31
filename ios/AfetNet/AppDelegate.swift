import Expo
import ExpoModulesCore
import UIKit

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  // Window property required by Expo Dev Launcher
  public var window: UIWindow?
  
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Create and make window key/visible BEFORE super call
    // Expo Dev Launcher checks for keyWindow during autoSetupStart
    if self.window == nil {
      self.window = UIWindow(frame: UIScreen.main.bounds)
    }
    self.window?.makeKeyAndVisible()
    
    // Let ExpoAppDelegate handle React Native initialization
    // This will trigger autoSetupPrepare and autoSetupStart
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    
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