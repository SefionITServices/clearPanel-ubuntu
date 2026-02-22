import React from "react";
import SectionTitle from "../common/SectionTitle";

const OurStory = () => {
  return (
    <>
      <section
        className="our-story-section pt-60 pb-120"
        style={{
          background:
            "url('/img/shape/dot-dot-wave-shape.svg')no-repeat left bottom",
        }}
      >
        <div className="container">
          <div className="row justify-content-between">
            <div className="col-lg-5 col-md-12 order-lg-1">
              <div className="section-heading sticky-sidebar">
                <SectionTitle
                  subtitle="Our Story"
                  title="Born from the Need for a Better Hosting Panel"
                  description="ClearPanel started as an internal tool at Sefion IT Services. Frustrated by the complexity and cost of existing control panels, we built something simpler, faster, and completely open-source."
                />
                <div className="mt-4">
                  <h6 className="mb-3">Built With Open-Source Values</h6>
                  <p className="text-muted">Every line of code is open, auditable, and community-driven. We believe server management should be accessible to everyone.</p>
                </div>
              </div>
            </div>
            <div className="col-lg-6 col-md-12 order-lg-0">
              <div className="story-grid-wrapper position-relative">
                {/* <!--animated shape start--> */}
                <ul className="position-absolute animate-element parallax-element shape-service z--1">
                  <li className="layer" data-depth="0.02">
                    <img
                      src="/img/color-shape/image-2.svg"
                      alt="shape"
                      className="img-fluid position-absolute color-shape-2 z-5"
                    />
                  </li>
                  <li className="layer" data-depth="0.03">
                    <img
                      src="/img/color-shape/feature-3.svg"
                      alt="shape"
                      className="img-fluid position-absolute color-shape-3"
                    />
                  </li>
                </ul>
                {/* <!--animated shape end--> */}
                <div className="story-grid rounded-custom bg-dark overflow-hidden position-relative">
                  <div className="story-item bg-light border">
                    <h3 className="display-5 fw-bold mb-1 text-success">
                      26+
                    </h3>
                    <h6 className="mb-0">Built-in Features</h6>
                  </div>
                  <div className="story-item bg-white border">
                    <h3 className="display-5 fw-bold mb-1 text-primary">
                      100%
                    </h3>
                    <h6 className="mb-0">Open Source</h6>
                  </div>
                  <div className="story-item bg-white border">
                    <h3 className="display-5 fw-bold mb-1 text-dark">&lt;5m</h3>
                    <h6 className="mb-0">Install Time</h6>
                  </div>
                  <div className="story-item bg-light border">
                    <h3 className="display-5 fw-bold mb-1 text-warning">
                      24/7
                    </h3>
                    <h6 className="mb-0">Community Support</h6>
                  </div>
                  <div className="story-item bg-light border">
                    <h3 className="display-5 fw-bold mb-1 text-danger">0</h3>
                    <h6 className="mb-0">Vendor Lock-in</h6>
                  </div>
                  <div className="story-item bg-white border">
                    <h3 className="display-5 fw-bold mb-1 text-primary">
                      MIT
                    </h3>
                    <h6 className="mb-0">Licensed</h6>
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

export default OurStory;
