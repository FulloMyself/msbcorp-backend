export const getLoanApplicationEmailTemplate = (loan, user, isAdmin = false) => {
  const formatCurrency = (amount) => 
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);

  const basicInfo = `
Loan Application Details:
------------------------
Amount: ${formatCurrency(loan.amount)}
Term: ${loan.term} months
Interest Rate: ${loan.interestRate}%
Status: ${loan.status}
Application Date: ${new Date(loan.createdAt).toLocaleDateString('en-ZA')}
`;

  // Additional details for admin emails
  const adminDetails = isAdmin ? `
Applicant Details:
-----------------
Name: ${user.name}
Email: ${user.email}
Contact: ${user.contact}

Bank Details:
------------
Bank: ${loan.bankDetails?.bankName || 'Not provided'}
Account Number: ${loan.bankDetails?.accountNumber || 'Not provided'}
Branch Code: ${loan.bankDetails?.branchCode || 'Not provided'}
Account Holder: ${loan.bankDetails?.accountHolder || 'Not provided'}
` : '';

  return `
Dear ${isAdmin ? 'Admin' : user.name},

${isAdmin ? 'A new loan application has been submitted.' : 'Your loan application has been received.'}

${basicInfo}
${adminDetails}

${isAdmin ? 'Please review this application in the admin dashboard.' : 'We will review your application and get back to you soon.'}

Best regards,
MSB Finance Team
`;
};