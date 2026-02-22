import React from "react";
import SectionTitle from "../common/SectionTitle";

const FeatureImgSix = () => {
  return (
    <>
      <section className="feature-section-two ptb-120">
        <div className="container">
          <div className="row align-items-center justify-content-lg-between justify-content-center">
            <div className="col-lg-6 col-md-12">
              <div className="feature-content-wrap">
                <SectionTitle
                  title="Server-Grade Tools for Modern Hosting"
                  description="ClearPanel brings enterprise hosting features to your Ubuntu server with an intuitive interface that makes complex tasks simple."
                  leftAlign
                />
                <ul className="list-unstyled mb-0">
                  <li className="d-flex align-items-start mb-4">
                    <div className="icon-box bg-primary rounded me-4">
                      <i className="fas fa-globe text-white"></i>
                    </div>
                    <div className="icon-content">
                      <h3 className="h5">Domain Manager</h3>
                      <p>
                        Add unlimited domains with automatic Nginx virtual host
                        configuration, DNS zone creation, and document root setup.
                      </p>
                    </div>
                  </li>
                  <li className="d-flex align-items-start mb-4">
                    <div className="icon-box bg-danger rounded me-4">
                      <i className="fas fa-lock text-white"></i>
                    </div>
                    <div className="icon-content">
                      <h3 className="h5">SSL Automation</h3>
                      <p>
                        One-click Let's Encrypt SSL certificate provisioning
                        with automatic renewal. HTTPS everywhere, effortlessly.
                      </p>
                    </div>
                  </li>
                  <li className="d-flex align-items-start mb-4 mb-lg-0">
                    <div className="icon-box bg-dark rounded me-4">
                      <i className="fas fa-cogs text-white"></i>
                    </div>
                    <div className="icon-content">
                      <h3 className="h5">Nginx Configuration</h3>
                      <p>
                        Visual Nginx management with reverse proxy support,
                        PHP-FPM integration, and per-site configuration editing.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-lg-6 col-md-7">
              <div className="feature-img-wrap">
                <img
                  src="/img/feature-hero-img.svg"
                  alt="feature"
                  className="img-fluid rounded-custom"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default FeatureImgSix;
