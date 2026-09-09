#!/usr/bin/env node
// Renders the CMS-managed sections of index.html from the JSON under data/.

const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const SERVICES_DIR = path.join(DATA_DIR, "services");
const POLICIES_DIR = path.join(DATA_DIR, "policies");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");
const INDEX_FILE = path.join(ROOT, "index.html");
const BUSINESS_INFO = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Stephanie Rumney Consultancy",
  alternateName: "src ed",
  description:
    "Specific Learning Difficulties Assessor and Specialist Teacher. Based in Northampton, UK. ",
  image: "https://www.src-ed.co.uk/images/logo.jpg",
  logo: "https://www.src-ed.co.uk/images/logo.jpg",
  url: "https://www.src-ed.co.uk",
  telephone: "+447974378350",
  email: "hello@src-ed.co.uk",
  address: {
    "@type": "PostalAddress",
    streetAddress: "9 Strixton Manor Business Centre, Strixton",
    addressLocality: "Wellingborough",
    addressRegion: "Northamptonshire",
    postalCode: "NN29 7PA",
    addressCountry: "GB",
  },
  geo: { "@type": "GeoCoordinates", latitude: "52.243304", longitude: "-0.686483" },
  priceRange: "££",
  openingHours: "Mo-Fr 09:00-17:00",
  sameAs: [
    "https://www.facebook.com/stephanierumneyconsultancy",
    "https://twitter.com/stephanierumne1",
    "https://www.linkedin.com/in/stephanie-rumney-033171234/",
  ],
  areaServed: {
    "@type": "GeoCircle",
    geoMidpoint: { "@type": "GeoCoordinates", latitude: "52.243304", longitude: "-0.686483" },
    geoRadius: "50000",
  },
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderJsonLd(services) {
  const offers = [];
  for (const service of services) {
    for (const offer of service.schemaOffers || []) {
      const entry = {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: offer.name,
          description: offer.description,
          provider: { "@type": "LocalBusiness", name: BUSINESS_INFO.name },
        },
      };
      if (offer.price !== undefined) {
        entry.price = String(offer.price);
        entry.priceCurrency = offer.priceCurrency || "GBP";
      }
      offers.push(entry);
    }
  }

  const payload = {
    ...BUSINESS_INFO,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Educational Assessment and Support Services",
      itemListElement: offers,
    },
  };

  const body = JSON.stringify(payload, null, 2);
  const indented = body
    .split("\n")
    .map((line) => "        " + line)
    .join("\n");
  return `      <script type="application/ld+json">\n${indented}\n      </script>`;
}

function renderCards(services) {
  const cards = services.filter((s) => s.card && s.modal);
  const rows = [];
  for (let i = 0; i < cards.length; i += 2) {
    const pair = cards.slice(i, i + 2);
    const cells = pair.map((svc, j) => {
      const delay = (i + j) * 100;
      const modalId = `${svc.id}Modal`;
      const { card } = svc;
      return `            <div class="col-md-6 col-lg-6 mb-6 mb-lg-6" data-aos="fade-up" data-aos-delay="${delay}">
               <div class="unit-6 d-flex">
                  <div class="unit-4-icon mr-4"><span class="text-primary ${escapeHtml(card.icon)}"></span></div>
                  <div>
                     <h3>${escapeHtml(card.title)}</h3>
                     <p>${escapeHtml(card.shortDescription)}</p>
                     <p>
                        <a href="#${modalId}" data-toggle="modal" data-target="#${modalId}">Learn More</a>
                     </p>
                  </div>
               </div>
            </div>`;
    });
    rows.push(
      `         <div class="row align-items-stretch">\n${cells.join("\n")}\n         </div>`
    );
  }
  return rows.join("\n");
}

function renderModals(services) {
  const blocks = [];
  for (const svc of services) {
    if (!svc.modal) continue;
    const modalId = `${svc.id}Modal`;
    const titleId = `${svc.id}ModalLongTitle`;
    const bullets = svc.modal.bullets
      .map((b) => `            <li>${escapeHtml(b)}</li>`)
      .join("\n");
    blocks.push(`      <div class="modal fade" id="${modalId}" tabindex="-1" role="dialog" aria-labelledby="${modalId}CenterTitle" aria-hidden="true">
         <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
               <div class="modal-header">
                  <h5 class="modal-title" id="${titleId}">${escapeHtml(svc.modal.title)}</h5>
                  <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                     <span aria-hidden="true">&times;</span>
                  </button>
               </div>
               <div class="modal-body">
                  <ul>
${bullets}
                  </ul>
               </div>
            </div>
         </div>
      </div>`);
  }
  return blocks.join("\n");
}

function renderFeeRows(services) {
  const rows = [];
  for (const svc of services) {
    for (const row of svc.feeRows || []) {
      rows.push(`      <tr>
         <td>${escapeHtml(row.label)}</td>
         <td align="right">${escapeHtml(row.price)}</td>
      </tr>`);
    }
  }
  return rows.join("\n");
}

function renderPolicyLinks(policies) {
  return policies
    .map(
      (p) =>
        `            <li><a href="${escapeHtml(p.file)}" target="_blank">${escapeHtml(p.title)}</a></li>`
    )
    .join("\n");
}

function renderAbout(about) {
  const body = markdown(about.body)
    .split("\n")
    .map((line) => "                  " + line)
    .join("\n");
  return `                  <h2 class="section-title mb-3 text-primary">${escapeHtml(about.heading)}</h2>\n${body}`;
}

function renderAboutModal(about) {
  const body = markdown(about.moreBody)
    .split("\n")
    .map((line) => "      " + line)
    .join("\n");
  return `      <div class="modal-header">
      <h5 class="modal-title" id="aboutMeModalCenterTitle">${escapeHtml(about.moreTitle)}</h5>
      <button type="button" class="close" data-dismiss="modal" aria-label="Close">
      <span aria-hidden="true">&times;</span>
      </button>
      </div>
      <div class="modal-body">
${body}
      </div>`;
}

function renderFooterAbout(footer) {
  const body = markdown(footer.aboutBody)
    .split("\n")
    .map((line) => "      " + line)
    .join("\n");
  return `      <h2 class="footer-heading mb-4">${escapeHtml(footer.aboutHeading)}</h2>\n${body}`;
}

function markdown(text) {
  return marked.parse(text || "", { async: false }).trim();
}

function readCollection(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
}

function replaceMarker(html, name, content) {
  const re = new RegExp(`(<!-- BEGIN:${name} -->)([\\s\\S]*?)(<!-- END:${name} -->)`);
  if (!re.test(html)) {
    throw new Error(`marker pair not found in index.html: ${name}`);
  }
  return html.replace(re, (_, begin, _mid, end) => `${begin}\n${content}\n      ${end}`);
}

function main() {
  const services = readCollection(SERVICES_DIR);
  const policies = readCollection(POLICIES_DIR);
  const content = JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8"));


  let html = fs.readFileSync(INDEX_FILE, "utf8");
  html = replaceMarker(html, "JSON_LD", renderJsonLd(services));
  html = replaceMarker(html, "SERVICE_CARDS", renderCards(services));
  html = replaceMarker(html, "SERVICE_MODALS", renderModals(services));
  html = replaceMarker(html, "FEE_ROWS", renderFeeRows(services));
  html = replaceMarker(html, "POLICY_LINKS", renderPolicyLinks(policies));
  html = replaceMarker(html, "ABOUT", renderAbout(content.about));
  html = replaceMarker(html, "ABOUT_MODAL", renderAboutModal(content.about));
  html = replaceMarker(html, "FOOTER_ABOUT", renderFooterAbout(content.footer));
  fs.writeFileSync(INDEX_FILE, html);
  console.error(`built index.html from ${services.length} services, ${policies.length} policies`);
}

main();
