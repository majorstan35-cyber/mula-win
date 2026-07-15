import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/terms')({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-[color:var(--background)] py-12 px-5 text-[8px] leading-relaxed text-[color:var(--muted-foreground)] font-mono max-w-4xl mx-auto">
      <div className="mb-8">
        <Link to="/" className="text-[10px] text-[color:var(--gold)] hover:underline">&larr; Back to Home</Link>
      </div>
      
      <h1 className="text-lg font-bold uppercase tracking-[0.2em] text-[color:var(--foreground)] mb-8 text-center">
        Terms & Conditions
      </h1>
      
      <div className="space-y-4 text-justify">
        <p>
          These Terms and Conditions constitute a legally binding agreement between you and the platform operator governing your access to and use of this digital service. By creating an account, accessing the platform, or engaging with any feature offered through this application, you acknowledge that you have read, understood, and agree to be bound by these Terms in their entirety. If you do not agree to these Terms, you must not access or use the platform. The platform reserves the right to update, modify, or replace any part of these Terms at its sole discretion. Your continued use of the platform following the posting of any changes constitutes acceptance of those changes. It is your responsibility to review these Terms periodically.
        </p>

        <p>
          The platform is intended solely for individuals who are at least eighteen years of age. By using this service, you represent and warrant that you are of legal age in your jurisdiction and that you have the legal capacity to enter into this agreement. If you are accessing the platform on behalf of another person or entity, you represent and warrant that you have the authority to bind that person or entity to these Terms. The platform reserves the right to verify the age and identity of any user at any time and may suspend or terminate accounts that do not meet the eligibility requirements.
        </p>

        <p>
          To access certain features of the platform, you may be required to create an account by providing accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account credentials, including your password, and for all activities that occur under your account. You agree to notify the platform immediately of any unauthorized use of your account or any other breach of security. The platform will not be liable for any loss or damage arising from your failure to protect your account information. You may not transfer your account to any other person or entity without the prior written consent of the platform.
        </p>

        <p>
          The platform provides an interactive digital entertainment service where users can participate in number-matching draws. Each participation requires a payment of the specified entry fee, which is processed through integrated mobile money services. By submitting a payment, you authorize the platform to charge the specified amount to your mobile money account. All payments are final and non-refundable unless otherwise required by applicable law. The platform does not store your financial credentials and relies on third-party payment processors to handle all monetary transactions securely. You acknowledge that the platform is not responsible for any errors, delays, or failures caused by third-party payment processors.
        </p>

        <p>
          The platform displays a set of twelve target numbers that participants attempt to match during each draw. Users submit their entry and the system generates a corresponding set of numbers. The degree of correlation between the user's generated numbers and the target numbers determines the outcome of each draw. The platform employs sophisticated algorithms and mathematical models to govern the generation of numbers and the determination of outcomes. These algorithms are designed to operate within defined statistical parameters that ensure the long-term sustainability and operational viability of the platform.
        </p>

        <p>
          Users acknowledge and accept that the platform incorporates an internal control mechanism that governs the probability of outcomes across all draws. This mechanism operates as part of the platform's standard operating procedures and is designed to manage the statistical distribution of results over defined operational periods. The internal control mechanism may adjust the probability parameters based on various factors, including but not limited to the total number of draws conducted, the aggregate volume of entries received, the cumulative revenue generated during an operational period, and other metrics that the platform deems relevant to its continued operation. Users understand that the probability of achieving a complete match of all twelve numbers is governed by these internal parameters and may vary across different operational periods.
        </p>

        <p>
          The platform operates on a cyclical basis, with each cycle representing a defined operational period during which draws are conducted. At the commencement of each cycle, the internal control parameters are initialized according to the platform's standard operating protocols. During the course of each cycle, the platform continuously monitors and evaluates the aggregate metrics described above. Until the platform's internal conditions for a given cycle have been fully satisfied, the mathematical probability of a complete twelve-number match remains within the restricted parameters defined by the control mechanism. Users may continue to participate in draws during this period and may achieve partial matches of varying degrees, but the algorithmic constraints govern the likelihood of a full twelve-number correlation occurring.
        </p>

        <p>
          Upon the satisfaction of the internal conditions for a given operational cycle, the platform's control mechanism transitions to a permissive state in which the restricted probability parameters are relaxed. In this subsequent phase, the system permits the mathematical possibility of a complete twelve-number match for qualifying participants. The occurrence of a complete match during the permissive phase triggers the conclusion of the current operational cycle and the distribution of the designated prize to the qualifying participant. Following the conclusion of a cycle, all internal control parameters, aggregate metrics, and probability matrices are reset for the initiation of a new operational cycle. The platform does not disclose the specific internal conditions, thresholds, or metrics that govern the transition between restricted and permissive phases, and users acknowledge that this information is proprietary and confidential.
        </p>

        <p>
          By participating in any draw on this platform, you expressly acknowledge and accept that the probability of achieving a complete twelve-number match is not uniformly distributed across all draws within an operational cycle. You waive any expectation of equal probability across individual draws and accept that the internal control mechanism may result in periods during which a complete match is statistically less likely to occur. The platform makes no representations, warranties, or guarantees regarding the likelihood of winning in any individual draw or across any specific number of draws. Your decision to participate in any draw is made at your own risk, and you assume full financial responsibility for all entry fees paid.
        </p>

        <p>
          All intellectual property rights in and to the platform, including but not limited to its design, layout, graphics, text, images, audio, video, software, algorithms, and underlying technology, are owned by or licensed to the platform operator. You may not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, download, store, or transmit any materials from the platform without the prior written consent of the platform operator. You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the platform solely for your personal, non-commercial use in accordance with these Terms.
        </p>

        <p>
          The platform may contain links to third-party websites, services, or resources that are not owned or controlled by the platform operator. The platform has no control over and assumes no responsibility for the content, privacy policies, or practices of any third-party websites or services. You acknowledge and agree that the platform is not responsible or liable for any damage or loss caused by or in connection with your use of or reliance on any content, goods, or services available through any third-party websites or services. We strongly advise you to read the terms and conditions and privacy policies of any third-party websites or services that you visit.
        </p>

        <p>
          You agree to use the platform only for lawful purposes and in accordance with these Terms. You agree not to use the platform in any way that violates any applicable local, national, or international law or regulation. You agree not to engage in any activity that could damage, disable, overburden, or impair the platform or interfere with any other party's use of the platform. You agree not to attempt to gain unauthorized access to any part of the platform, other accounts, computer systems, or networks connected to the platform through hacking, password mining, or any other means. You agree not to use any automated means, including robots, crawlers, or scrapers, to access the platform for any purpose without the prior written consent of the platform operator.
        </p>

        <p>
          The platform is provided on an as-is and as-available basis without any warranties of any kind, either express or implied. The platform operator disclaims all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. The platform operator does not warrant that the platform will be uninterrupted, timely, secure, or error-free, or that any defects in the platform will be corrected. You acknowledge that your use of the platform is at your sole risk.
        </p>

        <p>
          In no event shall the platform operator, its directors, officers, employees, agents, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the platform, any conduct or content of any third party on the platform, any content obtained from the platform, or unauthorized access use or alteration of your transmissions or content, whether based on warranty, contract, tort, or any other legal theory, whether or not the platform operator has been informed of the possibility of such damage.
        </p>

        <p>
          You agree to indemnify, defend, and hold harmless the platform operator, its directors, officers, employees, agents, and affiliates from and against any and all claims, liabilities, damages, losses, costs, expenses, or fees, including reasonable legal fees, arising from your use of the platform, your violation of these Terms, your violation of any rights of a third party, or your violation of any applicable law or regulation. This indemnification obligation will survive the termination of your account and your use of the platform.
        </p>

        <p>
          The platform operator reserves the right to suspend or terminate your account and your access to the platform at any time, with or without cause, and with or without notice. Upon termination, your right to use the platform will immediately cease. All provisions of these Terms that by their nature should survive termination shall survive, including but not limited to ownership provisions, warranty disclaimers, indemnity provisions, and limitations of liability. The platform operator shall not be liable to you or any third party for any termination of your access to the platform.
        </p>

        <p>
          These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the platform operator is established, without regard to its conflict of law provisions. Any dispute arising out of or relating to these Terms or your use of the platform shall be resolved through binding arbitration in accordance with the rules of the applicable arbitration body in the relevant jurisdiction. You agree that any arbitration shall be conducted on an individual basis and not as a class action or other representative proceeding. You waive any right to participate in a class action lawsuit or class-wide arbitration against the platform operator.
        </p>

        <p>
          If any provision of these Terms is found to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the invalidity, illegality, or unenforceability of that provision shall not affect the validity, legality, or enforceability of the remaining provisions of these Terms. The remaining provisions shall continue in full force and effect. The failure of the platform operator to enforce any right or provision of these Terms shall not constitute a waiver of that right or provision. These Terms constitute the entire agreement between you and the platform operator regarding your use of the platform and supersede all prior agreements, understandings, and negotiations, whether written or oral, between you and the platform operator.
        </p>

        <p>
          The platform operator may assign or transfer its rights and obligations under these Terms to any third party at any time without notice to you. You may not assign or transfer your rights or obligations under these Terms without the prior written consent of the platform operator. Any attempted assignment or transfer in violation of this provision shall be null and void. Notices to the platform operator should be sent to the contact information provided on the platform. Notices to you may be sent to the email address or phone number associated with your account.
        </p>

        <p>
          The platform collects and processes personal data in accordance with its Privacy Policy, which is incorporated into these Terms by reference. By using the platform, you consent to the collection, use, and disclosure of your personal data as described in the Privacy Policy. The platform implements reasonable security measures to protect your personal data from unauthorized access, use, or disclosure. However, no method of transmission over the internet or method of electronic storage is completely secure, and the platform cannot guarantee the absolute security of your personal data.
        </p>

        <p>
          The platform may use cookies, web beacons, and similar tracking technologies to collect information about your use of the platform and to improve your experience. You can manage your cookie preferences through your browser settings. However, disabling cookies may affect your ability to use certain features of the platform. By continuing to use the platform, you consent to the use of cookies and similar tracking technologies as described in the Privacy Policy.
        </p>

        <p>
          The platform may offer promotional offers, bonuses, or other incentives from time to time. These offers may be subject to additional terms and conditions, which will be communicated to you at the time of the offer. The platform reserves the right to modify, suspend, or discontinue any promotional offer at any time without prior notice. The platform shall not be liable for any loss or damage arising from the modification, suspension, or discontinuation of any promotional offer.
        </p>

        <p>
          Users are responsible for any taxes, duties, or other governmental charges that may be applicable to their use of the platform or any prizes or winnings received through the platform. The platform does not provide tax advice and recommends that users consult with a qualified tax professional regarding any tax obligations that may arise from their use of the platform. The platform may be required to report certain transactions or winnings to tax authorities in accordance with applicable law.
        </p>

        <p>
          The platform may communicate with you through various channels, including email, push notifications, in-app messages, and text messages. By creating an account, you consent to receive communications from the platform through these channels. You may opt out of certain communications by adjusting your notification preferences in your account settings. However, you may not opt out of essential communications related to your account, such as security alerts and transaction confirmations.
        </p>

        <p>
          These Terms were last updated on the date indicated at the top of this page. The platform reserves the right to modify these Terms at any time. If the platform makes material changes to these Terms, it will provide notice through the platform or by other means. Your continued use of the platform after any such changes constitutes your acceptance of the new Terms. If you do not agree to the modified Terms, you must stop using the platform.
        </p>

        <p>
          By using this platform, you acknowledge that you have read and understood these Terms and Conditions in their entirety and agree to be bound by them. If you have any questions about these Terms, please contact us through the contact information provided on the platform. Thank you for using our service and we hope you enjoy your experience.
        </p>
      </div>
    </div>
  );
}
