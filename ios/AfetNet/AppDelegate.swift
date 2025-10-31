import Expo
import ExpoModulesCore
import React

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Let ExpoAppDelegate handle complete initialization sequence first
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    
    // Ensure window is key and visible (required by Expo Dev Launcher)
    if self.window == nil {
      self.window = UIWindow(frame: UIScreen.main.bounds)
    }
    self.window?.makeKeyAndVisible()
    
    return result
  }

  // Preserve custom bundle URL for expo-dev-client
  public override func sourceURL(for bridge: RCTBridge) -> URL? {
    #if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
    #else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }

  // Preserve Linking API methods
  public override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  public override func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}