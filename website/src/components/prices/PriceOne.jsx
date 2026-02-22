import React from "react";
import { Link } from "react-router-dom";

const PriceOne = ({ paddingTop }) => {
  return (
    <>
      <section
        className={`pricing-section ${paddingTop} position-relative z-2`}
      >
        <div className="container">
          <div className="row">
            {/* Community Plan */}
            <div className="col-lg-4 col-md-6">
              <div className="position-relative single-pricing-wrap rounded-custom bg-white custom-shadow p-5 mb-4 mb-lg-0">
                <div className="pricing-header mb-32">
                  <h3 className="package-name text-primary d-block">Community</h3>
                  <h4 className="display-6 fw-semi-bold">
                    Free<span className="text-muted h6 fw-normal"> forever</span>
                  </h4>
                </div>
                <div className="pricing-info mb-4">
                  <ul className="pricing-feature-list list-unstyled">
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      Domain Management
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      Email Server (Postfix/Dovecot)
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      DNS Management (BIND9)
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      File Manager & Terminal
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      SSL Certificates (Let's Encrypt)
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      MySQL Database Manager
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      App Store (WordPress, phpMyAdmin)
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      Community Support
                    </li>
                  </ul>
                </div>
                <a
                  href="https://github.com/SefionITServices/clearPanel-ubuntu/blob/main/INSTALL.md"
                  className="btn btn-outline-primary mt-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Install Now
                </a>
                <div className="dot-shape-bg position-absolute z--1 left--40 bottom--40">
                  <img src="/img/shape/dot-big-square.svg" alt="shape" />
                </div>
              </div>
            </div>

            {/* Pro Plan */}
            <div className="col-lg-4 col-md-6">
              <div className="position-relative single-pricing-wrap rounded-custom bg-gradient text-white p-5 mb-4 mb-lg-0">
                <div className="pricing-header mb-32">
                  <h3 className="package-name text-warning d-block">Pro</h3>
                  <h4 className="display-6 fw-semi-bold">
                    $9<span>/month</span>
                  </h4>
                </div>
                <div className="pricing-info mb-4">
                  <ul className="pricing-feature-list list-unstyled">
                    <li>
                      <i className="fas fa-circle fa-2xs text-warning me-2"></i>
                      Everything in Community
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-warning me-2"></i>
                      Automated Backups & Restore
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-warning me-2"></i>
                      Two-Factor Authentication
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-warning me-2"></i>
                      Resource Monitoring Dashboard
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-warning me-2"></i>
                      Cron Job Manager
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-warning me-2"></i>
                      UFW Firewall Manager
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-warning me-2"></i>
                      Process Manager
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-warning me-2"></i>
                      Priority Email Support
                    </li>
                  </ul>
                </div>
                <Link to="/contact" className="btn btn-primary mt-2">
                  Get Started
                </Link>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="col-lg-4 col-md-6">
              <div className="position-relative single-pricing-wrap rounded-custom bg-white custom-shadow p-5 mb-4 mb-lg-0">
                <div className="pricing-header mb-32">
                  <h3 className="package-name text-primary d-block">Enterprise</h3>
                  <h4 className="display-6 fw-semi-bold">
                    $29<span>/month</span>
                  </h4>
                </div>
                <div className="pricing-info mb-4">
                  <ul className="pricing-feature-list list-unstyled">
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      Everything in Pro
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      Multi-User & Reseller Accounts
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      White-Label Branding
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      Docker Manager
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      Git Deployment
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      REST API & Webhooks
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      Activity & Audit Log
                    </li>
                    <li>
                      <i className="fas fa-circle fa-2xs text-primary me-2"></i>
                      Dedicated Support
                    </li>
                  </ul>
                </div>
                <Link to="/contact" className="btn btn-outline-primary mt-2">
                  Contact Sales
                </Link>
                <div className="dot-shape-bg position-absolute z--1 right--40 top--40">
                  <img src="/img/shape/dot-big-square.svg" alt="shape" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default PriceOne;
