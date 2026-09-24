// src/build/structured-data.test.ts
//
// P5 (audit P1-10): schema.org data for the site. Every value must
// already be visible on the site — no invented business facts (no geo,
// opening hours, email or social profiles: the site shows none).

import { describe, expect, test } from "bun:test";
import {
  ORGANIZATION_ID,
  breadcrumbJsonLd,
  organizationJsonLd,
  serviceBreadcrumbTrail,
  serviceJsonLd,
} from "./structured-data";
import { seguridadMinera, serviceGroups } from "./site-data";

const FORBIDDEN_KEYS = ["geo", "openingHours", "openingHoursSpecification", "email", "sameAs"];

function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => [key, ...allKeys(child)]);
  }
  return [];
}

describe("organizationJsonLd", () => {
  test("is the site-wide ProfessionalService with a stable @id", () => {
    expect(ORGANIZATION_ID).toBe("https://cominorsa.com/#organization");
    expect(organizationJsonLd["@type"]).toBe("ProfessionalService");
    expect(organizationJsonLd["@id"]).toBe(ORGANIZATION_ID);
    expect(organizationJsonLd.url).toBe("https://cominorsa.com");
    expect(organizationJsonLd.telephone).toBe("+51910728575");
    expect(organizationJsonLd.address.addressRegion).toBe("Piura");
  });

  test("lists both WhatsApp lines shown on the site as contact points", () => {
    const phones = organizationJsonLd.contactPoint.map((point) => point.telephone);
    expect(phones).toEqual(["+51910728575", "+51987817100"]);
    for (const point of organizationJsonLd.contactPoint) {
      expect(point["@type"]).toBe("ContactPoint");
    }
  });

  test("logo and image are absolute URLs of files that ship with the site", async () => {
    expect(organizationJsonLd.logo).toBe("https://cominorsa.com/apple-touch-icon.png");
    expect(organizationJsonLd.image).toBe("https://cominorsa.com/og.jpg");
    for (const url of [organizationJsonLd.logo, organizationJsonLd.image]) {
      const file = new URL(url).pathname;
      expect(await Bun.file(`public${file}`).exists()).toBe(true);
    }
  });

  test("areaServed reflects the site copy (Piura and the north of Peru)", () => {
    expect(organizationJsonLd.areaServed.map((area) => area.name)).toEqual([
      "Piura, Perú",
      "Norte del Perú",
    ]);
  });

  test("carries no facts the site doesn't show", () => {
    const keys = allKeys(organizationJsonLd);
    for (const key of FORBIDDEN_KEYS) expect(keys).not.toContain(key);
  });
});

describe("serviceJsonLd", () => {
  test("describes the service from existing data and points to the organization", () => {
    const data = serviceJsonLd(seguridadMinera);
    expect(data["@type"]).toBe("Service");
    expect(data.name).toBe(seguridadMinera.pageTitle);
    expect(data.description).toBe(seguridadMinera.pageDescription);
    expect(data.url).toBe("https://cominorsa.com/seguridad-minera");
    expect(data.provider).toEqual({ "@id": ORGANIZATION_ID });
    expect(data.areaServed).toEqual(organizationJsonLd.areaServed);
  });

  test("carries no facts the site doesn't show", () => {
    for (const service of serviceGroups) {
      const keys = allKeys(serviceJsonLd(service));
      for (const key of FORBIDDEN_KEYS) expect(keys).not.toContain(key);
    }
  });
});

describe("breadcrumbs", () => {
  test("a service trail is Inicio › Servicios › <servicio>", () => {
    expect(serviceBreadcrumbTrail(seguridadMinera)).toEqual([
      { name: "Inicio", path: "/" },
      { name: "Servicios", path: "/#servicios" },
      { name: seguridadMinera.pageTitle, path: "/seguridad-minera" },
    ]);
  });

  test("BreadcrumbList items are positioned from 1 with absolute URLs", () => {
    const data = breadcrumbJsonLd(serviceBreadcrumbTrail(seguridadMinera));
    expect(data["@type"]).toBe("BreadcrumbList");
    expect(data.itemListElement.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(data.itemListElement.map((item) => item.item)).toEqual([
      "https://cominorsa.com/",
      "https://cominorsa.com/#servicios",
      "https://cominorsa.com/seguridad-minera",
    ]);
    for (const item of data.itemListElement) expect(item["@type"]).toBe("ListItem");
  });
});
