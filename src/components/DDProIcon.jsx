import referenceImage from "../../IMG_9199.png";
import "./ddpro-reference-icons.css";

const iconCrops = {
  add: [1038, 516],
  "ai-assistant": [608, 516],
  calendar: [608, 516],
  check: [1038, 136],
  close: [608, 516],
  create: [1038, 516],
  delete: [608, 136],
  document: [1038, 136],
  download: [1038, 136],
  edit: [176, 136],
  finance: [608, 516],
  integration: [608, 516],
  integrations: [608, 516],
  "material-analysis": [176, 136],
  message: [1038, 136],
  messages: [1038, 136],
  new: [1038, 516],
  plus: [1038, 516],
  print: [176, 516],
  product: [176, 136],
  products: [176, 136],
  project: [1038, 516],
  projects: [1038, 516],
  procurement: [176, 136],
  refresh: [608, 516],
  report: [176, 516],
  reports: [176, 516],
  save: [1038, 136],
  search: [176, 136],
  send: [1038, 136],
  settings: [608, 516],
  system: [608, 516],
  systems: [608, 516],
  "price-analysis": [176, 136],
  offers: [176, 516],
  dashboard: [1038, 136],
  crm: [1038, 136],
  documents: [1038, 136],
  website: [176, 136],
  upload: [1038, 136],
  view: [1038, 136],
};

function DDProIcon({ name, className = "" }) {
  const [x, y] = iconCrops[name] || iconCrops.settings;

  return (
    <span
      className={`ddpro-icon-reference ${className}`.trim()}
      style={{
        "--ddpro-icon-reference": `url("${referenceImage}")`,
        "--ddpro-icon-x": `${(x / 1216) * 100}%`,
        "--ddpro-icon-y": `${(y / 704) * 100}%`,
      }}
      aria-hidden="true"
    />
  );
}

export default DDProIcon;
