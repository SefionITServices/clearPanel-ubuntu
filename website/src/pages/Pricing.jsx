import React from "react";
import PageHeader from "../components/common/PageHeader";
import PageMeta from "../components/common/PageMeta";
import CtaSubscribe from "../components/cta/CtaSubscribe";
import FaqTwo from "../components/faqs/FaqTwo";
import PriceOne from "../components/prices/PriceOne";
import TestimonialTwo from "../components/testimonial/TestimonialTwo";
import FooterOne from "../layout/Footer/FooterOne";
import Navbar from "../layout/Header/Navbar";
import Layout from "../layout/Layout";

const Pricing = () => {
  return (
    <Layout>
      <PageMeta title="Pricing — ClearPanel Server Control Panel" />
      <Navbar />
      <PageHeader
        title="Flexible Plans for Every Server"
        desc="Whether you're running a single VPS or managing multiple servers, ClearPanel has a plan that fits. Community edition is free forever."
      />
      <PriceOne paddingTop="ptb-120" />
      <FaqTwo />
      <TestimonialTwo bgWhite />
      <CtaSubscribe />
      <FooterOne footerLight />
    </Layout>
  );
};

export default Pricing;
