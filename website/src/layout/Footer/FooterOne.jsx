import React from "react";
import { Link } from "react-router-dom";
import { FaGithub, FaTwitter, FaDiscord } from "react-icons/fa";

const FooterOne = ({ footerLight, style, footerGradient }) => {
  return (
    <>
      <footer className="footer-section">
        <div
          className={`footer-top ${footerLight ? "footer-light" : "bg-dark"} ${
            footerGradient ? "bg-gradient" : ""
          }  text-white ptb-120`}
          style={style}
        >
          <div className="container">
            <div className="row justify-content-between">
              <div className="col-md-8 col-lg-4 mb-md-4 mb-lg-0">
                <div className="footer-single-col">
                  <div className="footer-single-col mb-4">
                    <img
                      src="/img/logo-white.png"
                      alt="ClearPanel"
                      className="img-fluid logo-white"
                    />
                    <img
                      src="/img/logo-color.png"
                      alt="ClearPanel"
                      className="img-fluid logo-color"
                    />
                  </div>
                  <p>
                    The next-generation open-source server control panel.
                    Manage your servers with ease — domains, email, DNS,
                    databases, and more from a single dashboard.
                  </p>

                  <form className="newsletter-form position-relative d-block d-lg-flex d-md-flex">
                    <input
                      type="text"
                      className="input-newsletter form-control me-2"
                      placeholder="Enter your email"
                      name="email"
                      required=""
                      autoComplete="off"
                    />
                    <input
                      type="submit"
                      value="Subscribe"
                      data-wait="Please wait..."
                      className="btn btn-primary mt-3 mt-lg-0 mt-md-0"
                    />
                  </form>
                </div>
              </div>
              <div className="col-md-12 col-lg-7 mt-4 mt-md-0 mt-lg-0">
                <div className="row">
                  <div className="col-md-4 col-lg-4 mt-4 mt-md-0 mt-lg-0">
                    <div className="footer-single-col">
                      <h3>Quick Links</h3>
                      <ul className="list-unstyled footer-nav-list mb-lg-0">
                        <li>
                          <Link to="/" className="text-decoration-none">
                            Home
                          </Link>
                        </li>
                        <li>
                          <Link to="/about" className="text-decoration-none">
                            About Us
                          </Link>
                        </li>
                        <li>
                          <Link to="/pricing" className="text-decoration-none">
                            Pricing
                          </Link>
                        </li>
                        <li>
                          <Link to="/contact" className="text-decoration-none">
                            Contact
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="col-md-4 col-lg-4 mt-4 mt-md-0 mt-lg-0">
                    <div className="footer-single-col">
                      <h3>Resources</h3>
                      <ul className="list-unstyled footer-nav-list mb-lg-0">
                        <li>
                          <a
                            href="https://github.com/SefionITServices/clearPanel-ubuntu/blob/main/INSTALL.md"
                            className="text-decoration-none"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Documentation
                          </a>
                        </li>
                        <li>
                          <a
                            href="https://github.com/SefionITServices/clearPanel-ubuntu/blob/main/ROADMAP.md"
                            className="text-decoration-none"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Roadmap
                          </a>
                        </li>
                        <li>
                          <a
                            href="https://github.com/SefionITServices/clearPanel-ubuntu/blob/main/CHANGELOG.md"
                            className="text-decoration-none"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Changelog
                          </a>
                        </li>
                        <li>
                          <a
                            href="https://github.com/SefionITServices/clearPanel-ubuntu"
                            className="text-decoration-none"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            GitHub
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="col-md-4 col-lg-4 mt-4 mt-md-0 mt-lg-0">
                    <div className="footer-single-col">
                      <h3>Support</h3>
                      <ul className="list-unstyled footer-nav-list mb-lg-0">
                        <li>
                          <Link to="/contact" className="text-decoration-none">
                            Contact Us
                          </Link>
                        </li>
                        <li>
                          <a
                            href="https://github.com/SefionITServices/clearPanel-ubuntu/discussions"
                            className="text-decoration-none"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Community
                          </a>
                        </li>
                        <li>
                          <a
                            href="https://github.com/SefionITServices/clearPanel-ubuntu/issues"
                            className="text-decoration-none"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Report a Bug
                          </a>
                        </li>
                        <li>
                          <a
                            href="https://github.com/SefionITServices/clearPanel-ubuntu/issues"
                            className="text-decoration-none"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Feature Request
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`footer-bottom ${
            footerLight ? "footer-light" : "bg-dark"
          } ${footerGradient ? "bg-gradient" : ""} text-white py-4`}
        >
          <div className="container">
            <div className="row justify-content-between align-items-center">
              <div className="col-md-7 col-lg-7">
                <div className="copyright-text">
                  <p className="mb-lg-0 mb-md-0">
                    &copy; {new Date().getFullYear()} ClearPanel by{" "}
                    <a
                      href="https://sefion.com"
                      className="text-decoration-none"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Sefion IT Services
                    </a>
                    . All rights reserved.
                  </p>
                </div>
              </div>
              <div className="col-md-4 col-lg-4">
                <div className="footer-single-col text-start text-lg-end text-md-end">
                  <ul className="list-unstyled list-inline footer-social-list mb-0">
                    <li className="list-inline-item">
                      <a
                        href="https://github.com/SefionITServices/clearPanel-ubuntu"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaGithub />
                      </a>
                    </li>
                    <li className="list-inline-item">
                      <a
                        href="https://twitter.com/clearpanel"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaTwitter />
                      </a>
                    </li>
                    <li className="list-inline-item">
                      <a
                        href="https://discord.gg/clearpanel"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaDiscord />
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default FooterOne;
