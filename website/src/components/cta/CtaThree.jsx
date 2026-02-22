import React from "react";
import { Link } from "react-router-dom";
import SectionTitle from "../common/SectionTitle";

const CtaThree = () => {
  return (
    <>
      <section className="cta-section bg-dark ptb-120 position-relative overflow-hidden">
        <div className="container">
          <div className="row align-items-center justify-content-between">
            <div className="col-lg-5 col-md-12">
              <div className="position-relative z-5">
                <SectionTitle
                  title="Built for Speed, Designed for Simplicity"
                  description="ClearPanel is the open-source alternative to expensive hosting panels. Install in minutes, manage with confidence."
                />
                <Link to="/pricing" className="btn btn-primary">
                  Get Started Free
                </Link>
              </div>
            </div>
            <div className="col-lg-6 col-md-12">
              <div className="row align-items-center justify-content-center position-relative z-2">
                <div className="col-md-6">
                  <div className="cta-card rounded-custom text-center shadow p-5 bg-white my-4">
                    <h3 className="display-5 fw-bold">26+</h3>
                    <p className="mb-0">
                      Built-in features for complete server management
                    </p>
                  </div>
                  <div className="cta-card rounded-custom text-center shadow p-5 bg-white my-4">
                    <h3 className="display-5 fw-bold">100%</h3>
                    <p className="mb-0">Free and open-source forever</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="cta-card rounded-custom text-center shadow p-5 bg-white">
                    <h3 className="display-5 fw-bold">&lt;5m</h3>
                    <p className="mb-0">
                      Install and configure in under 5 minutes
                    </p>
                  </div>
                </div>
                <div className="bg-circle rounded-circle position-absolute z--1">
                  <img
                    src="/img/shape/blob.svg"
                    alt="feature"
                    className="img-fluid rounded"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-circle rounded-circle circle-shape-3 position-absolute bg-dark-light left-30"></div>
          <div className="bg-circle rounded-circle circle-shape-1 position-absolute bg-warning left-5"></div>
        </div>
      </section>
    </>
  );
};

export default CtaThree;
