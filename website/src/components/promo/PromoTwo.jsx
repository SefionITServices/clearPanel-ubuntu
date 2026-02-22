import React from "react";
import SectionTitle from "../common/SectionTitle";

const PromoTwo = () => {
  return (
    <>
      <section className="promo-section ptb-120">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-6 col-md-10">
              <SectionTitle
                title="Everything You Need to Manage Your Server"
                description="ClearPanel brings together all the tools you need for web hosting management — domains, email, DNS, databases, and security — in one clean interface."
                centerAlign
              />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-4 col-md-6">
              <div className="promo-single position-relative text-center bg-white custom-shadow rounded-custom p-5 mb-4">
                <div className="promo-icon mb-32">
                  <i className="fas fa-server text-primary fa-3x"></i>
                </div>
                <div className="promo-info">
                  <h3 className="h5">Easy Server Management</h3>
                  <p className="mb-0">
                    Manage domains, Nginx, SSL certificates, and PHP versions
                    through an intuitive web interface. No command line required.
                  </p>
                </div>
                {/* <!--pattern start--> */}
                <div className="dot-shape-bg position-absolute z--1 left--40 top--40">
                  <img src="/img/shape/dot-big-square.svg" alt="shape" />
                </div>
                {/* <!--pattern end--> */}
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="promo-single position-relative text-center bg-white custom-shadow rounded-custom p-5 mb-4">
                <div className="promo-icon mb-32">
                  <i className="fas fa-shield-alt text-success fa-3x"></i>
                </div>
                <div className="promo-info">
                  <h3 className="h5">Rock-Solid Security</h3>
                  <p className="mb-0">
                    Built-in UFW firewall management, two-factor authentication,
                    automated SSL, and server monitoring keep your servers safe.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="promo-single position-relative text-center bg-white custom-shadow rounded-custom p-5 mb-4">
                <div className="promo-icon mb-32">
                  <i className="fas fa-rocket text-danger fa-3x"></i>
                </div>
                <div className="promo-info">
                  <h3 className="h5">Lightning Performance</h3>
                  <p className="mb-0">
                    Nginx-powered web serving, real-time resource monitoring,
                    process management, and cron automation for peak performance.
                  </p>
                </div>
                {/* <!--pattern start--> */}
                <div className="dot-shape-bg position-absolute z--1 right--40 bottom--40">
                  <img src="/img/shape/dot-big-square.svg" alt="shape" />
                </div>
                {/* <!--pattern end--> */}
              </div>
            </div>
          </div>
          <div className="customer-section pt-60">
            <div className="container">
              <div className="row justify-content-center">
                <div className="col-lg-8 col-12">
                  <div className="customer-logos-grid text-center">
                    <img
                      src="/img/clients/client-logo-1.svg"
                      width="150"
                      alt="clients logo"
                      className="img-fluid p-1 px-md-2 p-lg-3 m-auto"
                    />
                    <img
                      src="/img/clients/client-logo-2.svg"
                      width="150"
                      alt="clients logo"
                      className="img-fluid p-1 px-md-2 p-lg-3 m-auto"
                    />
                    <img
                      src="/img/clients/client-logo-3.svg"
                      width="150"
                      alt="clients logo"
                      className="img-fluid p-1 px-md-2 p-lg-3 m-auto"
                    />
                    <img
                      src="/img/clients/client-logo-4.svg"
                      width="150"
                      alt="clients logo"
                      className="img-fluid p-1 px-md-2 p-lg-3 m-auto"
                    />
                    <img
                      src="/img/clients/client-logo-5.svg"
                      width="150"
                      alt="clients logo"
                      className="img-fluid p-1 px-md-2 p-lg-3 m-auto"
                    />
                    <img
                      src="/img/clients/client-logo-6.svg"
                      width="150"
                      alt="clients logo"
                      className="img-fluid p-1 px-md-2 p-lg-3 m-auto"
                    />
                    <img
                      src="/img/clients/client-logo-7.svg"
                      width="150"
                      alt="clients logo"
                      className="img-fluid p-1 px-md-2 p-lg-3 m-auto"
                    />
                    <img
                      src="/img/clients/client-logo-8.svg"
                      width="150"
                      alt="clients logo"
                      className="img-fluid p-1 px-md-2 p-lg-3 m-auto"
                    />
                  </div>
                  <p className="text-center mt-5 mb-0 h6">
                    Trusted More than 25,00+ Companies Around the World
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default PromoTwo;
