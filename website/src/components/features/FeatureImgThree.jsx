import React from "react";
import SectionTitle from "../common/SectionTitle";

const FeatureImgThree = ({ paddingTop }) => {
  return (
    <>
      <section
        className={`feature-section-two ${
          paddingTop ? "ptb-120" : "pt-60 pb-120"
        } `}
      >
        <div className="container">
          <div className="row align-items-center justify-content-between">
            <div className="col-lg-5 col-md-12">
              <SectionTitle
                subtitle="Why Open Source"
                title="Transparent, Secure & Community-Driven"
                description="ClearPanel is built in the open. Every feature is auditable, every decision is transparent, and the community drives the roadmap."
              />
              <div>
                <ul className="list-unstyled mt-5">
                  <li className="d-flex align-items-start mb-4">
                    <div className="icon-box bg-primary rounded me-4">
                      <i className="fas fa-code-branch text-white"></i>
                    </div>
                    <div className="icon-content">
                      <h3 className="h5">Fork &amp; Customize</h3>
                      <p>
                        Full access to the source code means you can customize
                        every aspect of ClearPanel to fit your exact workflow.
                      </p>
                    </div>
                  </li>
                  <li className="d-flex align-items-start mb-4">
                    <div className="icon-box bg-danger rounded me-4">
                      <i className="fas fa-shield-alt text-white"></i>
                    </div>
                    <div className="icon-content">
                      <h3 className="h5">Security You Can Verify</h3>
                      <p>
                        No black-box code. Audit the security yourself or trust
                        the community that reviews every pull request.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-lg-6 col-md-7">
              <div className="feature-img-wrap position-relative d-flex flex-column align-items-end">
                <ul className="img-overlay-list list-unstyled position-absolute">
                  <li
                    className="d-flex align-items-center bg-white rounded shadow-sm p-3"
                    data-aos="fade-right"
                    data-aos-delay="50"
                  >
                    <i className="fas fa-check bg-primary text-white rounded-circle"></i>
                    <h6 className="mb-0">MIT Licensed — Free Forever</h6>
                  </li>
                  <li
                    className="d-flex align-items-center bg-white rounded shadow-sm p-3"
                    data-aos="fade-right"
                    data-aos-delay="100"
                  >
                    <i className="fas fa-check bg-primary text-white rounded-circle"></i>
                    <h6 className="mb-0">Active Community on GitHub</h6>
                  </li>
                  <li
                    className="d-flex align-items-center bg-white rounded shadow-sm p-3"
                    data-aos="fade-right"
                    data-aos-delay="150"
                  >
                    <i className="fas fa-check bg-primary text-white rounded-circle"></i>
                    <h6 className="mb-0">Regular Updates &amp; Releases</h6>
                  </li>
                </ul>
                <img
                  src="/img/feature-img3.jpg"
                  alt="feature"
                  className="img-fluid rounded-custom"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default FeatureImgThree;
