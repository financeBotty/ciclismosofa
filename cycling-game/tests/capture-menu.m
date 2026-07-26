#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

@interface MenuCaptureDelegate : NSObject <WKNavigationDelegate>
@property(nonatomic, strong) NSURL *outputURL;
@property(nonatomic, copy) NSString *mode;
@end

@implementation MenuCaptureDelegate

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    NSString *inspect = [NSString stringWithFormat:
        @"(() => {"
         "window.ciclimoTourGame.setMenuGameMode('%@');"
         "const card = document.querySelector('.menu-card').getBoundingClientRect();"
         "const mode = getComputedStyle(document.querySelector('#tourModeButton span'));"
         "const slot = getComputedStyle(document.querySelector('.slot-action'));"
         "return {"
           "cardTop: card.top, cardBottom: card.bottom, viewportHeight: innerHeight,"
           "modeFont: mode.fontSize, slotFont: slot.fontSize,"
           "quickVisible: !document.querySelector('#quickModePanel').classList.contains('is-hidden'),"
           "tourHidden: document.querySelector('#tourModePanel').classList.contains('is-hidden')"
         "};"
         "})();", self.mode];
    [webView evaluateJavaScript:inspect completionHandler:^(NSDictionary *result, NSError *error) {
        if (error || ![result isKindOfClass:NSDictionary.class]) {
            fprintf(stderr, "No se pudo inspeccionar el menú: %s\n", error.localizedDescription.UTF8String);
            [NSApp terminate:nil];
            return;
        }
        if ([result[@"cardTop"] doubleValue] < 0 ||
            [result[@"cardBottom"] doubleValue] > [result[@"viewportHeight"] doubleValue]) {
            fprintf(stderr, "El menú no cabe en el viewport: %s\n", result.description.UTF8String);
            [NSApp terminate:nil];
            return;
        }
        WKSnapshotConfiguration *configuration = [WKSnapshotConfiguration new];
        configuration.rect = NSMakeRect(0, 0, webView.bounds.size.width, webView.bounds.size.height);
        [webView takeSnapshotWithConfiguration:configuration
                             completionHandler:^(NSImage *image, NSError *snapshotError) {
            if (snapshotError || !image) {
                fprintf(stderr, "No se pudo tomar la captura: %s\n",
                        snapshotError.localizedDescription.UTF8String);
                [NSApp terminate:nil];
                return;
            }
            NSBitmapImageRep *bitmap =
                [[NSBitmapImageRep alloc] initWithData:image.TIFFRepresentation];
            NSData *png = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
            if (![png writeToURL:self.outputURL atomically:YES]) {
                fprintf(stderr, "No se pudo guardar la captura.\n");
                [NSApp terminate:nil];
            } else {
                NSString *launchQuickRace =
                    @"(() => {"
                     "const game = window.ciclimoTourGame;"
                     "game.storage.tutorialSeen = true;"
                     "document.querySelector('#quickRaceButton').click();"
                     "game.state = 'RACING';"
                     "game.race.cyclists.forEach((rider, index) => {"
                       "rider.finishTime = 3600 + index * 3;"
                       "rider.distance = game.race.road.lengthKm;"
                       "rider.finished = true;"
                     "});"
                     "game.race.elapsed = 3900;"
                     "game.finishRace();"
                     "const card = document.querySelector('.results-card');"
                     "const actions = document.querySelector('.results-actions');"
                     "const actionTopBefore = actions.getBoundingClientRect().top;"
                     "card.scrollTop = card.scrollHeight;"
                     "const actionTopAfter = actions.getBoundingClientRect().top;"
                     "return { state: game.state, mode: game.gameMode,"
                       "stages: game.tour.stages.length, cyclists: game.race.cyclists.length,"
                       "actionTopBefore, actionTopAfter,"
                       "stickyDelta: Math.abs(actionTopBefore - actionTopAfter) };"
                     "})();";
                [webView evaluateJavaScript:launchQuickRace completionHandler:^(NSDictionary *launch, NSError *launchError) {
                    BOOL validLaunch = !launchError &&
                        [launch[@"state"] isEqual:@"FINISHED"] &&
                        [launch[@"mode"] isEqual:@"quick"] &&
                        [launch[@"stages"] integerValue] == 1 &&
                        [launch[@"cyclists"] integerValue] == 100 &&
                        [launch[@"stickyDelta"] doubleValue] <= 1;
                    if (!validLaunch) {
                        fprintf(stderr, "Carrera rápida no arrancó: %s\n",
                                (launchError.localizedDescription ?: launch.description).UTF8String);
                    } else {
                        printf("%s\n%s\n%s\n", result.description.UTF8String,
                               launch.description.UTF8String, self.outputURL.path.UTF8String);
                    }
                    [NSApp terminate:nil];
                }];
            }
        }];
    }];
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *application = NSApplication.sharedApplication;
        [application setActivationPolicy:NSApplicationActivationPolicyProhibited];

        NSURL *projectURL =
            [NSURL fileURLWithPath:NSFileManager.defaultManager.currentDirectoryPath isDirectory:YES];
        NSURL *indexURL = [projectURL URLByAppendingPathComponent:@"index.html"];
        CGFloat captureWidth = argc > 1 ? MAX(320, atof(argv[1])) : 1440;
        CGFloat captureHeight = argc > 2 ? MAX(560, atof(argv[2])) : 900;
        NSString *captureMode = argc > 3 && strcmp(argv[3], "tour") == 0 ? @"tour" : @"quick";
        NSString *outputName = captureWidth <= 600
            ? [NSString stringWithFormat:@"captura-menu-movil-%@.png", captureMode]
            : @"captura-menu-modos.png";
        NSURL *outputURL = [projectURL URLByAppendingPathComponent:outputName];

        WKWebViewConfiguration *configuration = [WKWebViewConfiguration new];
        configuration.websiteDataStore = WKWebsiteDataStore.nonPersistentDataStore;
        [configuration.preferences setValue:@YES forKey:@"allowFileAccessFromFileURLs"];

        NSRect frame = NSMakeRect(0, 0, captureWidth, captureHeight);
        WKWebView *webView = [[WKWebView alloc] initWithFrame:frame configuration:configuration];
        NSWindow *window = [[NSWindow alloc]
            initWithContentRect:frame
                      styleMask:NSWindowStyleMaskBorderless
                        backing:NSBackingStoreBuffered
                          defer:NO];
        [window setFrameOrigin:NSMakePoint(-4000, -4000)];
        window.contentView = webView;

        MenuCaptureDelegate *delegate = [MenuCaptureDelegate new];
        delegate.outputURL = outputURL;
        delegate.mode = captureMode;
        webView.navigationDelegate = delegate;
        [webView loadFileURL:indexURL allowingReadAccessToURL:projectURL];
        [application run];
    }
    return 0;
}
