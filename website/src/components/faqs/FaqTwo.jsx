import React from "react";
import SectionTitle from "../common/SectionTitle";

const FaqTwo = () => {
  return (
    <>
      <section className="faq-section ptb-120 bg-light">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-7 col-12">
              <SectionTitle
                subtitle="FAQ"
                title="Frequently Asked Questions"
                description="Got questions about ClearPanel? Here are the most common ones. Can't find your answer? Reach out to us."
                centerAlign
              />
            </div>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-7 col-12">
              <div className="accordion faq-accordion" id="accordionExample">
                <div className="accordion-item border border-2 active">
                  <h5 className="accordion-header" id="faq-1">
                    <button
                      className="accordion-button"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target="#collapse-1"
                      aria-expanded="true"
                    >
                      Is ClearPanel really free?
                    </button>
                  </h5>
                  <div
                    id="collapse-1"
                    className="accordion-collapse collapse show"
                    aria-labelledby="faq-1"
                    data-bs-parent="#accordionExample"
                  >
                    <div className="accordion-body">
                      Yes! The Community edition is 100% free and open-source
                      under the MIT license. It includes all core features
                      like domain management, email server, DNS, file manager,
                      SSL automation, databases, and the app store. Pro and
                      Enterprise plans add advanced features like automated
                      backups, 2FA, monitoring, multi-user support, and
                      priority support.
                    </div>
                  </div>
                </div>

                <div className="accordion-item border border-2">
                  <h5 className="accordion-header" id="faq-2">
                    <button
                      className="accordion-button collapsed"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target="#collapse-2"
                      aria-expanded="false"
                    >
                      What are the system requirements?
                    </button>
                  </h5>
                  <div
                    id="collapse-2"
                    className="accordion-collapse collapse"
                    aria-labelledby="faq-2"
                    data-bs-parent="#accordionExample"
                  >
                    <div className="accordion-body">
                      ClearPanel requires Ubuntu 22.04 LTS or 24.04 LTS with
                      at least 1GB RAM and 20GB disk space. A fresh VPS
                      installation is recommended for best results. The
                      installer handles all dependency installation
                      automatically.
                    </div>
                  </div>
                </div>

                <div className="accordion-item border border-2">
                  <h5 className="accordion-header" id="faq-3">
                    <button
                      className="accordion-button collapsed"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target="#collapse-3"
                      aria-expanded="false"
                    >
                      How long does installation take?
                    </button>
                  </h5>
                  <div
                    id="collapse-3"
                    className="accordion-collapse collapse"
                    aria-labelledby="faq-3"
                    data-bs-parent="#accordionExample"
                  >
                    <div className="accordion-body">
                      Installation takes less than 5 minutes on most VPS
                      providers. Simply SSH into your server, run the one-line
                      installer script, and follow the web-based setup wizard.
                      The installer configures Nginx, Node.js, and all required
                      services automatically.
                    </div>
                  </div>
                </div>

                <div className="accordion-item border border-2">
                  <h5 className="accordion-header" id="faq-4">
                    <button
                      className="accordion-button collapsed"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target="#collapse-4"
                      aria-expanded="false"
                    >
                      Can I migrate from cPanel or other panels?
                    </button>
                  </h5>
                  <div
                    id="collapse-4"
                    className="accordion-collapse collapse"
                    aria-labelledby="faq-4"
                    data-bs-parent="#accordionExample"
                  >
                    <div className="accordion-body">
                      Yes! ClearPanel includes migration tools and
                      documentation to help you move domains, email accounts,
                      databases, and files from cPanel, Plesk, and other
                      hosting panels. Our step-by-step guides make the
                      transition smooth and straightforward.
                    </div>
                  </div>
                </div>

                <div className="accordion-item border border-2">
                  <h5 className="accordion-header" id="faq-5">
                    <button
                      className="accordion-button collapsed"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target="#collapse-5"
                      aria-expanded="false"
                    >
                      What kind of support is available?
                    </button>
                  </h5>
                  <div
                    id="collapse-5"
                    className="accordion-collapse collapse"
                    aria-labelledby="faq-5"
                    data-bs-parent="#accordionExample"
                  >
                    <div className="accordion-body">
                      Community users get access to our GitHub Issues tracker,
                      community discussions, and documentation. Pro users
                      receive priority email support with faster response
                      times. Enterprise customers get dedicated support with
                      a guaranteed SLA.
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

export default FaqTwo;
