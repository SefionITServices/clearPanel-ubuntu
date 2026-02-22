import React from "react";
import { Link } from "react-router-dom";
import SectionTitle from "../common/SectionTitle";

const LatestBlogTwo = () => {
  return (
    <>
      <section className="home-blog-section ptb-120 bg-white">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-6 col-md-12">
              <SectionTitle
                subtitle="Updates"
                title="Latest from ClearPanel"
                description="Stay up to date with the latest features, guides, and release notes from the ClearPanel team."
                centerAlign
              />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-4 col-md-6">
              <div className="single-article rounded-custom mb-4 mb-lg-0">
                <Link to="/blog-single" className="article-img">
                  <img
                    src="/img/blog/blog-1.jpg"
                    alt="article"
                    className="img-fluid"
                  />
                </Link>
                <div className="article-content p-4">
                  <div className="article-category mb-4 d-block">
                    <Link
                      to="#"
                      className="d-inline-block text-dark badge bg-warning-soft"
                    >
                      Release
                    </Link>
                  </div>
                  <Link to="#">
                    <h2 className="h5 article-title limit-2-line-text">
                      ClearPanel v2.1 — Cron, Firewall, Monitoring & More
                    </h2>
                  </Link>
                  <p className="limit-2-line-text">
                    The latest release brings 6 powerful new features: cron job
                    manager, UFW firewall control, resource monitoring, automated
                    backups, two-factor authentication, and process management.
                  </p>

                  <Link to="#/">
                    <div className="d-flex align-items-center pt-4">
                      <div className="avatar">
                        <img
                          src="/img/testimonial/6.jpg"
                          alt="avatar"
                          width="40"
                          className="img-fluid rounded-circle me-3"
                        />
                      </div>
                      <div className="avatar-info">
                        <h6 className="mb-0 avatar-name">Jane Martin</h6>
                        <span className="small fw-medium text-muted">
                          April 24, 2021
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="single-article rounded-custom mb-4 mb-lg-0">
                <Link to="/blog-single" className="article-img">
                  <img
                    src="/img/blog/blog-2.jpg"
                    alt="article"
                    className="img-fluid"
                  />
                </Link>
                <div className="article-content p-4">
                  <div className="article-category mb-4 d-block">
                    <a
                      href="#/"
                      className="d-inline-block text-dark badge bg-primary-soft"
                    >
                      Guide
                    </a>
                  </div>
                  <Link to="#">
                    <h2 className="h5 article-title limit-2-line-text">
                      How to Set Up a Complete Email Server with ClearPanel
                    </h2>
                  </Link>
                  <p className="limit-2-line-text">
                    Learn how to provision email domains, create mailboxes,
                    configure DKIM/SPF/DMARC, and set up Roundcube webmail —
                    all from the ClearPanel dashboard.
                  </p>

                  <Link to="#/">
                    <div className="d-flex align-items-center pt-4">
                      <div className="avatar">
                        <img
                          src="/img/testimonial/1.jpg"
                          alt="avatar"
                          width="40"
                          className="img-fluid rounded-circle me-3"
                        />
                      </div>
                      <div className="avatar-info">
                        <h6 className="mb-0 avatar-name">Veronica P. Byrd</h6>
                        <span className="small fw-medium text-muted">
                          April 24, 2021
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="single-article rounded-custom mb-4 mb-lg-0 mb-md-0">
                <Link to="/blog-single" className="article-img">
                  <img
                    src="/img/blog/blog-3.jpg"
                    alt="article"
                    className="img-fluid"
                  />
                </Link>
                <div className="article-content p-4">
                  <div className="article-category mb-4 d-block">
                    <Link
                      to="#/"
                      className="d-inline-block text-dark badge bg-danger-soft"
                    >
                      Tutorial
                    </Link>
                  </div>
                  <Link to="#">
                    <h2 className="h5 article-title limit-2-line-text">
                      Migrating from cPanel to ClearPanel: A Complete Guide
                    </h2>
                  </Link>
                  <p className="limit-2-line-text">
                    Step-by-step instructions for migrating your domains,
                    databases, email accounts, and files from cPanel to
                    ClearPanel on a fresh Ubuntu VPS.
                  </p>

                  <Link to="#/">
                    <div className="d-flex align-items-center pt-4">
                      <div className="avatar">
                        <img
                          src="/img/testimonial/3.jpg"
                          alt="avatar"
                          width="40"
                          className="img-fluid rounded-circle me-3"
                        />
                      </div>
                      <div className="avatar-info">
                        <h6 className="mb-0 avatar-name">Martin Gilbert</h6>
                        <span className="small fw-medium text-muted">
                          April 24, 2021
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="row justify-content-center">
            <div className="text-center mt-5">
              <Link to="#" className="btn btn-primary">
                View All Updates
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default LatestBlogTwo;
