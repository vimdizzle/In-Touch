"use client";

import Link from "next/link";

export default function PrivacyPage() {
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
            PRIVACY
          </h1>
          <h2 className="text-3xl font-bold">Privacy Policy</h2>
          <p className="text-xs text-gray-500 mt-2">Last Updated: May 30, 2026</p>
        </div>

        {/* Content Container */}
        <div className="bg-[#0b1120] border border-gray-800 rounded-lg p-6 sm:p-8 space-y-8 text-gray-300 leading-relaxed">
          <section className="space-y-3">
            <p>
              At <strong>In Touch</strong>, we take your privacy seriously. This Privacy Policy describes how we collect, store, protect, and use your personal information and the contact records you manage within our application.
            </p>
            <p>
              By accessing or using the Service, you agree to the collection and use of information in accordance with this Privacy Policy.
            </p>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">1. Information We Collect</h3>
            <p>
              We collect two categories of information to provide you with the relationship-tracking features of our Service:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account Information:</strong> When you sign up, we collect your email address and basic profile details (such as your name). This is necessary to authenticate your login sessions and secure your account.
              </li>
              <li>
                <strong>Relationship Management Data:</strong> To help you stay in touch, you may choose to input data about your contacts. This includes contact names, relationships, locations, birthdays, desired follow-up cadences, customized notes, and logs of your past interactions (&ldquo;touchpoints&rdquo;).
              </li>
            </ul>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">2. How We Use Your Information</h3>
            <p>
              We use the collected data solely for the following purposes:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide, operate, and maintain the features of the Service (e.g., displaying contact lists, calculating timezone differences, sorting upcoming touchpoints, and saving interaction logs).</li>
              <li>To manage your user account and authenticate your sign-in requests.</li>
              <li>To respond to user-submitted inquiries, bug reports, and feedback.</li>
              <li>To secure the Service, prevent fraud, and ensure proper technical operation.</li>
            </ul>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">3. Data Sharing and Disclosure</h3>
            <p>
              We are committed to maintaining the confidentiality of your personal relationships and data. 
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>No Commercial Sharing:</strong> We do not sell, rent, lease, trade, or distribute your email address, account information, or personal contact records to any third-party advertisers, brokers, or marketing firms.
              </li>
              <li>
                <strong>Trusted Subprocessors:</strong> We only share information with trusted third-party service providers (such as cloud hosting, authentication, and database services, including Supabase and Vercel) that are strictly necessary to store your data and operate the Service. These providers are contractually obligated to protect your data.
              </li>
              <li>
                <strong>Legal Requirements:</strong> We may disclose information if required to do so by law, court order, or governmental authority to comply with legal proceedings or protect the safety and rights of our users or the public.
              </li>
            </ul>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">4. Data Security and Storage</h3>
            <p>
              Your contact data is stored securely in our database utilizing industry-standard encryption, firewalls, and security policies. We implement strict Row Level Security (RLS) policies at the database level, ensuring that only your authenticated account can read, write, update, or delete your specific contact and touchpoint records.
            </p>
            <p>
              While we use standard, robust security measures to safeguard your information, please be aware that no method of transmission over the internet or electronic storage is 100% secure.
            </p>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">5. Your Control and Deletion Rights</h3>
            <p>
              You maintain complete control over the relationship information you store in In Touch:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Edit and Delete:</strong> You can edit or permanently delete any contact or logged touchpoint directly within the application interface at any time.
              </li>
              <li>
                <strong>Account Deletion:</strong> You have the right to delete your account entirely. Deleting your account will permanently remove all of your profile details, contact lists, relationship history, and notes from our active databases.
              </li>
            </ul>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">6. Changes to This Privacy Policy</h3>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &ldquo;Last Updated&rdquo; date at the top of this document. We encourage you to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <hr className="border-gray-800" />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">7. Contact Information</h3>
            <p>
              If you have any questions or concerns regarding this Privacy Policy, please reach out to us using the in-app feedback channel. This allows us to securely verify your account identity and address your inquiry promptly.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
