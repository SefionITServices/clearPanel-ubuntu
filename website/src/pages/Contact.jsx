import React from "react";
import ContactBox from "../components/contact/ContactBox";
import ContactFormTwo from "../components/contact/ContactFormTwo";
import PageHeader from "../components/common/PageHeader";
import PageMeta from "../components/common/PageMeta";
import FooterOne from "../layout/Footer/FooterOne";
import Navbar from "../layout/Header/Navbar";
import Layout from "../layout/Layout";

const Contact = () => {
  return (
    <Layout>
      <PageMeta title="Contact — ClearPanel Server Control Panel" />
      <Navbar classOption="navbar-light" />
      <PageHeader
        title="Get in Touch"
        desc="Have questions about ClearPanel? Need help with installation or configuration? We're here to help."
      />
      <ContactBox />
      <ContactFormTwo />
      <FooterOne footerLight />
    </Layout>
  );
};

export default Contact;
