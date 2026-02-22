import React from "react";
import { Link } from "react-router-dom";

import SectionTitle from "../common/SectionTitle";

const TabOne = () => {
  return (
    <>
      <section className="feature-tab-section ptb-120 bg-light">
        <div className="container">
          <div className="row justify-content-center align-content-center">
            <div className="col-md-10 col-lg-6">
              <SectionTitle
                subtitle="Features"
                title="Powerful Server Management Features"
                description="ClearPanel provides a complete suite of tools for managing every aspect of your web server — from domains and email to databases and security."
                centerAlign
              />
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <ul
                className="nav justify-content-center feature-tab-list-2 mb-0"
                id="nav-tab"
                role="tablist"
              >
                <li className="nav-item">
                  <Link
                    className="nav-link active"
                    to="#tab-1"
                    data-bs-toggle="tab"
                    data-bs-target="#tab-1"
                    role="tab"
                    aria-selected="false"
                  >
                    Website Management
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className="nav-link"
                    to="#tab-2"
                    data-bs-toggle="tab"
                    data-bs-target="#tab-2"
                    role="tab"
                    aria-selected="false"
                  >
                    Email & DNS
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className="nav-link"
                    to="#tab-3"
                    data-bs-toggle="tab"
                    data-bs-target="#tab-3"
                    role="tab"
                    aria-selected="false"
                  >
                    One-Click Apps
                  </Link>
                </li>
              </ul>
              <div className="tab-content" id="nav-tabContent">
                <div
                  className="tab-pane fade pt-60 active show"
                  id="tab-1"
                  role="tabpanel"
                >
                  <div className="row justify-content-center align-items-center justify-content-around">
                    <div className="col-lg-5">
                      <div className="feature-tab-info">
                        <h3>Website Management</h3>
                        <p>
                          Manage unlimited domains with Nginx virtual hosts,
                          automated SSL certificate provisioning via Let's Encrypt,
                          and PHP version management — all from a clean web interface.
                        </p>
                        <p>
                          Built-in file manager with code editor, terminal access,
                          and SSH key management give you full control over your
                          web server without leaving the browser.
                        </p>
                        <Link
                          to="/about"
                          className="read-more-link text-decoration-none mt-4 d-block"
                        >
                          Learn More
                          <i className="far fa-arrow-right ms-2"></i>
                        </Link>
                      </div>
                    </div>
                    <div className="col-lg-5">
                      <img
                        src="/img/screen/widget-12.png"
                        alt="feature tab"
                        className="img-fluid mt-4 mt-lg-0 mt-xl-0"
                      />
                    </div>
                  </div>
                </div>
                <div className="tab-pane fade pt-60" id="tab-2" role="tabpanel">
                  <div className="row justify-content-center align-items-center justify-content-around">
                    <div className="col-lg-5">
                      <img
                        src="/img/screen/widget-8.png"
                        alt="feature tab"
                        className="img-fluid mb-4 mb-lg-0 mb-xl-0"
                      />
                    </div>
                    <div className="col-lg-5">
                      <div className="feature-tab-info">
                        <h3>Email & DNS</h3>
                        <p>
                          Complete email server management with Postfix, Dovecot,
                          and OpenDKIM. Create email accounts, forwarders, and
                          filters with automatic DKIM/SPF/DMARC configuration.
                        </p>
                        <p>
                          Full BIND9 DNS server with zone editor, record management,
                          and automated DNS provisioning for new domains. Manage
                          A, AAAA, CNAME, MX, TXT, and SRV records.
                        </p>
                        <Link
                          to="/about"
                          className="read-more-link text-decoration-none mt-4 d-block"
                        >
                          Learn More
                          <i className="far fa-arrow-right ms-2"></i>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="tab-pane fade pt-60" id="tab-3" role="tabpanel">
                  <div className="row justify-content-center align-items-center justify-content-around">
                    <div className="col-lg-5">
                      <div className="feature-tab-info">
                        <h3>One-Click Apps</h3>
                        <p>
                          Install WordPress, phpMyAdmin, and Roundcube webmail
                          with a single click. Our app store handles all
                          dependencies, database setup, and configuration.
                        </p>
                        <p>
                          MySQL/MariaDB database management with user creation,
                          privilege management, and phpMyAdmin integration.
                          Create and manage databases without touching the CLI.
                        </p>
                        <Link
                          to="/about"
                          className="read-more-link text-decoration-none mt-4 d-block"
                        >
                          Learn More
                          <i className="far fa-arrow-right ms-2"></i>
                        </Link>
                      </div>
                    </div>
                    <div className="col-lg-5">
                      <img
                        src="/img/screen/widget-11.png"
                        alt="feature tab"
                        className="img-fluid mt-4 mt-lg-0 mt-xl-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default TabOne;
