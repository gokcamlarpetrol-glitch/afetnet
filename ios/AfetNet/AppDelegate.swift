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
    // Create window BEFORE super call so Expo Dev Launcher can access it
    // Expo Dev Launcher checks UIApplication.shared.delegate?.window during autoSetupStart
    if self.window == nil {
      self.window = UIWindow(frame: UIScreen.main.bounds)
      // Set a temporary root view controller so window is properly initialized
      self.window?.rootViewController = UIViewController()
      // Make window key and visible BEFORE super call
      // Expo Dev Launcher requires keyWindow during autoSetupStart
      self.window?.makeKeyAndVisible()
    }
    
    // Let ExpoAppDelegate handle React Native initialization
    // This will trigger autoSetupPrepare and autoSetupStart
    // Expo Dev Launcher will access window during autoSetupStart
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