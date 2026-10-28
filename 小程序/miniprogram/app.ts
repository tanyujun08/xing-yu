import { installDemoPlatform, installLinkedPlatform } from './preview/platform';




App({
  onLaunch() { installDemoPlatform(); installLinkedPlatform(); },
  globalData: {
    version: '1.0.2.0'
  },
});
