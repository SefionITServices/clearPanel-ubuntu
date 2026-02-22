import React from "react";
import { Link } from "react-router-dom";
import HeroTitle from "../../components/common/HeroTitle";

const HeroFive = () => {
  return (
    <>
      <section
        className="hero-section ptb-120 d-flex align-items-center bg-dark text-white position-relative overflow-hidden"
        style={{
          background: "url('/img/page-header-bg.svg')no-repeat bottom right",
        }}
      >
        <div className="container">
          <div className="row justify-content-between align-items-center">
            <div className="col-lg-6">
              <div className="hero-content-wrap">
                <HeroTitle
                  subtitle="#1 Open-Source Hosting Panel"
                  title="Next-Gen Server Control Panel"
                  desc="Manage domains, email, DNS, databases, SSL, and more from one powerful dashboard. Free, open-source, and built for modern servers."
                />

                <div className="action-btns mt-5">
                  <Link to="/pricing" className="btn btn-primary me-3">
                    Get Started Free
                  </Link>
                  <a
                    href="https://github.com/SefionITServices/clearPanel-ubuntu/blob/main/INSTALL.md"
                    className="btn btn-outline-light"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Documentation
                  </a>
                </div>
              </div>
              <div className="row justify-content-lg-start mt-60">
                <h6 className="text-white-70 mb-2">Powered By:</h6>
                <div className="col-4 col-sm-3 my-2 ps-lg-0">
                  <img
                    src="/img/clients/client-1.svg"
                    alt="technology"
                    className="img-fluid"
                  />
                </div>
                <div className="col-4 col-sm-3 my-2">
                  <img
                    src="/img/clients/client-2.svg"
                    alt="technology"
                    className="img-fluid"
                  />
                </div>
                <div className="col-4 col-sm-3 my-2">
                  <img
                    src="/img/clients/client-3.svg"
                    alt="technology"
                    className="img-fluid"
                  />
                </div>
              </div>
            </div>
            <div className="col-lg-6 col-md-8 mt-5 mt-lg-0">
              <div className="animated-img-wrap">
                <ul className="animate-element parallax-element animated-hero-1 position-relative">
                  <li className="layer" data-depth="0.02">
                    <img
                      src="/img/screen/animated-screen-2.svg"
                      alt="ClearPanel Dashboard"
                      className="img-fluid position-absolute type-0"
                    />
                  </li>
                </ul>
                <img
                  src="/img/screen/animated-screen-1.svg"
                  alt="ClearPanel Interface"
                  className="position-relative img-fluid"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default HeroFive;
