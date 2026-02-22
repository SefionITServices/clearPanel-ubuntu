import React from "react";
import { Link } from "react-router-dom";

import SectionTitle from "../common/SectionTitle";

const CtaTwo = () => {
  return (
    <>
      <section className="cta-subscribe bg-dark ptb-120 position-relative overflow-hidden">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8 col-md-10">
              <div className="subscribe-info-wrap text-center position-relative z-2">
                <SectionTitle
                  subtitle="Ready to Get Started?"
                  title="Take Control of Your Server Today"
                  description="Install ClearPanel in under 5 minutes and start managing domains, email, DNS, and more — completely free."
                  dark
                />
                <div className="form-block-banner mw-60 m-auto mt-5">
                  <Link to="/pricing" className="btn btn-primary">
                    Get Started Free
                  </Link>
                  <a
                    href="https://github.com/SefionITServices/clearPanel-ubuntu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline-light ms-3"
                  >
                    <i className="fab fa-github me-2"></i>View Source
                  </a>
                </div>
                <ul
                  className="nav justify-content-center subscribe-feature-list mt-4"
                  data-aos="fade-up"
                  data-aos-delay="100"
                >
                  <li className="nav-item">
                    <span>
                      <i className="far fa-check-circle text-primary me-2"></i>
                      Free &amp; open-source
                    </span>
                  </li>
                  <li className="nav-item">
                    <span>
                      <i className="far fa-check-circle text-primary me-2"></i>
                      Ubuntu 22.04 / 24.04
                    </span>
                  </li>
                  <li className="nav-item">
                    <span>
                      <i className="far fa-check-circle text-primary me-2"></i>
                      One-command install
                    </span>
                  </li>
                  <li className="nav-item">
                    <span>
                      <i className="far fa-check-circle text-primary me-2"></i>
                      No vendor lock-in
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div
            className="
              bg-circle
              rounded-circle
              circle-shape-3
              position-absolute
              bg-dark-light
              left-5
            "
          ></div>
          <div
            className="
              bg-circle
              rounded-circle
              circle-shape-1
              position-absolute
              bg-warning
              right-5
            "
          ></div>
        </div>
      </section>
    </>
  );
};

export default CtaTwo;
