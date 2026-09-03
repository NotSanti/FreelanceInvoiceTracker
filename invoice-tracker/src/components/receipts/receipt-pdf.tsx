import { renderToBuffer } from "@react-pdf/renderer";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { PaymentReceiptModel } from "@/lib/receipt/document";

Font.registerHyphenationCallback((word) => [word]);

const colors = {
  ink: "#2a241c",
  muted: "#6f675c",
  line: "#ddd6cc",
  positive: "#2f6b4f",
};

const styles = StyleSheet.create({
  page: {
    color: colors.ink,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.45,
    paddingBottom: 56,
    paddingHorizontal: 48,
    paddingTop: 48,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 24,
  },
  businessName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  muted: {
    color: colors.muted,
  },
  kicker: {
    color: colors.muted,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.6,
    textAlign: "right",
    textTransform: "uppercase",
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    marginTop: 4,
    textAlign: "right",
  },
  rule: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    marginVertical: 22,
  },
  sectionLabel: {
    color: colors.muted,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  parties: {
    flexDirection: "row",
    gap: 32,
  },
  party: {
    flex: 1,
  },
  partyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginBottom: 4,
  },
  amountBlock: {
    marginTop: 8,
  },
  amountLabel: {
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  amountValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 28,
    letterSpacing: -0.4,
    marginTop: 6,
  },
  rows: {
    marginTop: 8,
  },
  row: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  rowLabel: {
    color: colors.muted,
  },
  rowValue: {
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  status: {
    color: colors.positive,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginTop: 18,
  },
  footer: {
    bottom: 28,
    color: colors.muted,
    fontSize: 8,
    left: 48,
    position: "absolute",
    right: 48,
  },
});

function ReceiptPdfDocument({ document }: { document: PaymentReceiptModel }) {
  return (
    <Document
      title={`${document.receiptTitle} · ${document.invoiceNumber}`}
      author={document.businessName}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.businessName}>{document.businessName}</Text>
            {document.businessAddress.map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
            <Text style={styles.muted}>{document.businessEmail}</Text>
            {document.businessPhone ? (
              <Text style={styles.muted}>{document.businessPhone}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.kicker}>Receipt</Text>
            <Text style={styles.title}>{document.receiptTitle}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.sectionLabel}>Billed to</Text>
            <Text style={styles.partyName}>{document.clientName}</Text>
            {document.clientCompany ? (
              <Text style={styles.muted}>{document.clientCompany}</Text>
            ) : null}
            <Text style={styles.muted}>{document.clientEmail}</Text>
          </View>
          <View style={styles.party}>
            <Text style={styles.sectionLabel}>Invoice</Text>
            <Text style={styles.partyName}>{document.invoiceNumber}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Amount paid</Text>
          <Text style={styles.amountValue}>{document.amountPaidLabel}</Text>
        </View>

        <View style={styles.rows}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Payment date</Text>
            <Text style={styles.rowValue}>{document.paidOnLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Payment method</Text>
            <Text style={styles.rowValue}>{document.methodLabel}</Text>
          </View>
          {document.reference ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Reference</Text>
              <Text style={styles.rowValue}>{document.reference}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Invoice total</Text>
            <Text style={styles.rowValue}>{document.invoiceTotalLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Balance remaining</Text>
            <Text style={styles.rowValue}>{document.remainingLabel}</Text>
          </View>
        </View>

        {document.isPaidInFull ? (
          <Text style={styles.status}>This invoice is paid in full.</Text>
        ) : null}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${document.invoiceNumber} receipt  ·  ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

export async function renderPaymentReceiptPdf(document: PaymentReceiptModel) {
  return renderToBuffer(<ReceiptPdfDocument document={document} />);
}
