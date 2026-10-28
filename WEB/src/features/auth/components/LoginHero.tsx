import {
  DeviceIcon,
  OrderIcon,
  ShopIcon,
  Star1Icon,
  ViewInArIcon,
  WalletIcon,
} from '../../../shared/design/icons';
import { APPLICATION_VERSION } from '../../../shared/version';

const features = [
  { label: '商家', icon: <ShopIcon /> },
  { label: '租赁柜', icon: <DeviceIcon /> },
  { label: '资产', icon: <ViewInArIcon /> },
  { label: '订单', icon: <OrderIcon /> },
  { label: '结算', icon: <WalletIcon /> },
];

export function LoginHero() {
  return (
    <section className="login-hero" aria-label="星遇租赁管理后台">
      <div className="login-hero-stage">
        <div className="login-hero-art" aria-hidden="true" />
        <div className="login-hero-scrim" aria-hidden="true" />
        <Star1Icon className="login-hero-star" aria-hidden="true" />

        <div className="login-hero-copy">
          <div className="login-hero-title-row">
            <h1>星遇租赁管理后台</h1>
          </div>
          <p className="login-hero-statement">
            让每一台设备
            <br />
            有迹可循
          </p>
          <div className="login-hero-features" aria-label="后台核心模块">
            {features.map((feature, index) => (
              <span className="login-hero-feature" key={feature.label}>
                {feature.icon}
                <span>{feature.label}</span>
                {index < features.length - 1 ? (
                  <span className="login-hero-feature-dot" aria-hidden="true">
                    ·
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>

        <p className="login-hero-version">v{APPLICATION_VERSION}</p>
      </div>
    </section>
  );
}
