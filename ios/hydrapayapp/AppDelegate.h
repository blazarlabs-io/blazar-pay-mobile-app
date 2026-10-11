#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <Expo/Expo.h>

@interface AppDelegate : EXAppDelegateWrapper

// Starts React Native. Called by SceneDelegate once the window scene connects.
- (void)startReactNativeWithURL:(nullable NSURL *)url;

@end
