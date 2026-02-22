import React from "react";
import SectionTitle from "../common/SectionTitle";

const FeatureImgSeven = () => {
  return (
    <>
      <section className="why-choose-us pt-60 pb-120">
        <div className="container">
          <div className="row justify-content-lg-between justify-content-center align-items-center">
            <div className="col-lg-5 col-md-7 order-1 order-lg-0">
              <div className="why-choose-img position-relative">
                <img
                  src="/img/feature-hero-img-2.svg"
                  className="img-fluid"
                  alt="duel-phone"
                />
              </div>
            </div>
            <div className="col-lg-6 col-md-12 order-0 order-lg-1">
              <div className="why-choose-content">
                <div className="mb-32">
                  <SectionTitle
                    title="26+ Features Built for Hosting Professionals"
                    description="From domain management to email servers, ClearPanel covers every tool you need to run a professional web hosting environment."
                    leftAlign
                  />
                </div>
                <ul className="list-unstyled d-flex flex-wrap list-two-col">
                  <li className="py-1">
                    <i className="fas fa-check-circle me-2 text-primary"></i>
                    Domain Management
                  </li>
                  <li className="py-1">
                    <i className="fas fa-check-circle me-2 text-primary"></i>
                    Email Server (SMTP/IMAP)
                  </li>
                  <li className="py-1">
                    <i className="fas fa-check-circle me-2 text-primary"></i>
                    DNS Server (BIND9)
                  </li>
                  <li className="py-1">
                    <i className="fas fa-check-circle me-2 text-primary"></i>
                    MySQL Database Manager
                  </li>
                  <li className="py-1">
                    <i className="fas fa-check-circle me-2 text-primary"></i>
                    File Manager & Editor
                  </li>
                  <li className="py-1">
                    <i className="fas fa-check-circle me-2 text-primary"></i>
                    Firewall & 2FA Security
                  </li>
                  <li className="py-1">
                    <i className="fas fa-check-circle me-2 text-primary"></i>
                    Backup & Restore
                  </li>
                  <li className="py-1">
                    <i className="fas fa-check-circle me-2 text-primary"></i>
                    Resource Monitoring
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default FeatureImgSeven;
