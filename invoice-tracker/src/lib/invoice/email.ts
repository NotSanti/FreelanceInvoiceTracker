export function firstNameFrom(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

export function defaultInvoiceEmail({
  clientName,
  invoiceNumber,
  businessName,
  publicUrl,
}: {
  clientName: string;
  invoiceNumber: string;
  businessName: string;
  publicUrl?: string;
}) {
  const greeting = firstNameFrom(clientName);
  const payLine = publicUrl
    ? " You can view the invoice and payment instructions using the button in this email."
    : "";

  return {
    subject: `Invoice ${invoiceNumber} from ${businessName}`,
    message: `Hi ${greeting},\n\nPlease find invoice ${invoiceNumber} attached.${payLine}\n\nThank you,\n${businessName}`,
  };
}
