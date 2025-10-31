import Expo
import ExpoModulesCore

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Let ExpoAppDelegate handle complete initialization sequence
    // This ensures autoSetupPrepare is called before autoSetupStart
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    
    // Ensure window is key and visible (required by Expo Dev Launcher)
    // ExpoAppDelegate creates the window, but we need to make it key/visible
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