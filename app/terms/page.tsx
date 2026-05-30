"use client";

import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col animate-fadeIn">
      <div className="max-w-4xl mx-auto p-4 sm:p-8 flex-1 w-full">
        {/* Navigation */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-gray-400 hover:text-white mb-4 inline-flex items-center gap-2 transition-colors duration-200"
          >
            ← Back to App
          </Link>
          <h1 className="text-sm uppercase tracking-widest text-gray-400 mb-2 font-bold tracking-[0.2em]">
            LEGAL
          </h1>
          <h2 className="text-3xl font-bold">Terms & Conditions</h2>
          <p className="text-xs text-gray-500 mt-2">Last Updated: May 30, 2026</p>
        </div>

        {/* Content Container */}
        <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-6 sm:p-8 space-y-8 text-gray-300 leading-relaxed">
          <section className="space-y-3">
            <p>
              Welcome to <strong>In Touch</strong>. These Terms & Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the In Touch web application and related services (collectively, the &ldquo;Service&rdquo;).
            </p>
            <p>
              By creating an account, logging in, or using our Service, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use the Service.
            </p>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">1. Account Registration and Security</h3>
            <p>
              To access the Service, you must create an account using a valid email address and password or an authorized third-party authentication provider (such as Google Sign-In). 
            </p>
            <p>
              You are entirely responsible for maintaining the confidentiality and security of your login credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use or security breach of your account.
            </p>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">2. Management of Personal CRM and Contact Records</h3>
            <p>
              In Touch is a personal CRM designed to help you organize and stay in touch with your friends, family, and professional contacts. The Service allows you to store contact details (names, relationships, locations, birthdays) and log interactions (&ldquo;touchpoints&rdquo;).
            </p>
            <p>
              You retain all ownership, rights, and responsibility for the data and information you input into the Service. You agree that you will not enter any contact records or notes that violate any applicable privacy laws or infringe upon the rights of others.
            </p>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">3. Acceptable Use and Restrictions</h3>
            <p>
              You agree to use the Service only for lawful, personal purposes. You shall not:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Service in any way that violates local, national, or international laws or regulations.</li>
              <li>Upload, transmit, or store content that is offensive, harmful, defamatory, or infringes intellectual property.</li>
              <li>Attempt to interfere with, compromise, or disrupt the security or integrity of our servers, database, or infrastructure.</li>
              <li>Reverse engineer, copy, or distribute any portion of the application codebase or layout.</li>
            </ul>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">4. Service Modifications and Availability</h3>
            <p>
              We strive to provide continuous and reliable service, but the Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We reserve the right to modify, suspend, or discontinue the Service, or any part thereof, at any time with or without notice. We are not liable to you or any third party for any service interruptions, downtime, or data loss.
            </p>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">5. Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by applicable law, In Touch, its developers, and operators shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages. This includes, but is not limited to, damages for loss of profits, goodwill, use, data, or other intangible losses arising out of or in connection with your use or inability to use the Service.
            </p>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">6. Changes to These Terms</h3>
            <p>
              We reserve the right to update or modify these Terms & Conditions at any time. When we make updates, we will revise the &ldquo;Last Updated&rdquo; date at the top of this page. Your continued use of the Service following any changes constitutes your acceptance of the revised Terms.
            </p>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">7. Contact and Feedback</h3>
            <p>
              If you have any questions, feedback, or concerns regarding these Terms, please submit them through our in-app feedback tool. This is the fastest and most secure method to reach the development and support team.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
