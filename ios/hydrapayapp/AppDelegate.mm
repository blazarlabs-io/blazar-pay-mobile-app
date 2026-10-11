#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>

// Apps built with the iOS 27 SDK must use the UIScene life cycle, otherwise UIKit
// stops them at launch. React Native 0.74 creates its window in
// application:didFinishLaunchingWithOptions:, so React Native is started when the
// window scene connects, and its window is attached to that scene.
@interface SceneDelegate : UIResponder <UIWindowSceneDelegate>
@property (nonatomic, strong) UIWindow *window;
@end

@implementation SceneDelegate

- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)connectionOptions
{
  AppDelegate *app = (AppDelegate *)UIApplication.sharedApplication.delegate;
  NSURL *url = connectionOptions.URLContexts.anyObject.URL;
  if (app.window == nil) {
    [app startReactNativeWithURL:url];
  } else if (url != nil) {
    // The scene was discarded and reconnected while the app kept running.
    [RCTLinkingManager application:UIApplication.sharedApplication openURL:url options:@{}];
  }
  self.window = app.window;
  self.window.windowScene = (UIWindowScene *)scene;
  [self.window makeKeyAndVisible];
}

// Deep links while the app runs (replaces application:openURL:options: under scenes).
- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts
{
  for (UIOpenURLContext *context in URLContexts) {
    [RCTLinkingManager application:UIApplication.sharedApplication openURL:context.URL options:@{}];
  }
}

@end

@implementation AppDelegate {
  NSDictionary *_launchOptions;
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"main";

  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  // React Native starts in startReactNativeWithURL:, called by SceneDelegate.
  _launchOptions = launchOptions;
  return YES;
}

- (void)startReactNativeWithURL:(NSURL *)url
{
  NSMutableDictionary *options = [NSMutableDictionary dictionaryWithDictionary:_launchOptions ?: @{}];
  if (url != nil) {
    // Under scenes a cold-start deep link comes with the scene connection, not in
    // launchOptions; RCTLinkingManager getInitialURL reads it from launchOptions.
    options[UIApplicationLaunchOptionsURLKey] = url;
  }
  [super application:UIApplication.sharedApplication didFinishLaunchingWithOptions:options];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@".expo/.virtual-metro-entry"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

// Linking API
- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options {
  return [super application:application openURL:url options:options] || [RCTLinkingManager application:application openURL:url options:options];
}

// Universal Links
- (BOOL)application:(UIApplication *)application continueUserActivity:(nonnull NSUserActivity *)userActivity restorationHandler:(nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler {
  BOOL result = [RCTLinkingManager application:application continueUserActivity:userActivity restorationHandler:restorationHandler];
  return [super application:application continueUserActivity:userActivity restorationHandler:restorationHandler] || result;
}

// Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  return [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

// Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  return [super application:application didFailToRegisterForRemoteNotificationsWithError:error];
}

// Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
{
  return [super application:application didReceiveRemoteNotification:userInfo fetchCompletionHandler:completionHandler];
}

@end
