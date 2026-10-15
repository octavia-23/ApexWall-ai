import { describe, it, expect } from "vitest";
import {
  deriveACDKey,
  decryptACDataArchive,
  parseACSetupINI,
} from "@/lib/ac-mod-parser";

describe("Assetto Corsa Mod Ingestor & ACD Decryption Engine", () => {
  describe("deriveACDKey", () => {
    it("deterministically derives the exact 8-octet key for a known car folder", () => {
      const key = deriveACDKey("aston_martin_amr25");
      expect(key).toBe("21-9-121-207-150-14-74-54");
    });

    it("is strictly case-insensitive", () => {
      const keyLower = deriveACDKey("aston_martin_amr25");
      const keyUpper = deriveACDKey("ASTON_MARTIN_AMR25");
      const keyMixed = deriveACDKey("Aston_Martin_AMR25");

      expect(keyUpper).toBe(keyLower);
      expect(keyMixed).toBe(keyLower);
    });

    it("produces valid 8-octet formatted string", () => {
      const key = deriveACDKey("ferrari_488_gt3");
      const parts = key.split("-");
      expect(parts.length).toBe(8);
      parts.forEach((p) => {
        const num = parseInt(p, 10);
        expect(num).toBeGreaterThanOrEqual(0);
        expect(num).toBeLessThanOrEqual(255);
      });
    });
  });

  describe("decryptACDataArchive", () => {
    it("accurately decrypts an encoded Assetto Corsa data archive buffer", () => {
      const folderName = "test_car";
      const key = deriveACDKey(folderName);
      const testContent = "[HEADER]\nVERSION=2\n\n[BASIC]\nTOTALMASS=800\n";
      const fileName = "car.ini";

      // Build synthetic encrypted ACD buffer
      // Structure:
      // [nameLen (int32)] [nameBytes] [contentLen (int32)] [contentInts (4 bytes each)]
      const nameBytes = Buffer.from(fileName, "ascii");
      const contentBytes = Buffer.from(testContent, "ascii");

      const bufSize = 4 + nameBytes.length + 4 + contentBytes.length * 4;
      const buf = Buffer.alloc(bufSize);
      let offset = 0;

      buf.writeInt32LE(nameBytes.length, offset);
      offset += 4;
      nameBytes.copy(buf, offset);
      offset += nameBytes.length;

      buf.writeInt32LE(contentBytes.length, offset);
      offset += 4;

      for (let i = 0; i < contentBytes.length; i++) {
        const decByte = contentBytes[i];
        const keyByte = key.charCodeAt(i % key.length);
        const encryptedByte = (decByte + keyByte) & 0xff;
        buf.writeInt32LE(encryptedByte, offset + i * 4);
      }

      const uint8 = new Uint8Array(buf);
      const decrypted = decryptACDataArchive(uint8, folderName);

      expect(decrypted["car.ini"]).toBe(testContent);
    });

    it("handles truncated or empty buffers gracefully without crashing", () => {
      const empty = new Uint8Array(0);
      const res = decryptACDataArchive(empty, "any_car");
      expect(Object.keys(res).length).toBe(0);

      const corrupted = new Uint8Array([10, 0, 0, 0, 97]);
      const resCorrupt = decryptACDataArchive(corrupted, "any_car");
      expect(Object.keys(resCorrupt).length).toBe(0);
    });
  });

  describe("parseACSetupINI", () => {
    it("extracts sliders, legal ranges, and steps from setup.ini", () => {
      const sampleSetupIni = `
[DISPLAY_METHOD]
SHOW_CLICKS=1

[WING_1]
NAME=Front Wing
MIN=0
MAX=16
STEP=1
POS_X=0.5
POS_Y=1
HELP=HELP_FRONT_WING

[WING_2]
NAME=Rear Wing
MIN=0
MAX=16
STEP=1
POS_X=0.5
POS_Y=2
HELP=HELP_REAR_WING

[DIFF_POWER]
NAME=Power
MIN=10
MAX=100
STEP=5
`;
      const parsed = parseACSetupINI(sampleSetupIni, "setup.ini");
      expect(parsed.sliders.length).toBe(3);

      const fw = parsed.sliders.find((s) => s.key === "WING_1");
      expect(fw?.name).toBe("Front Wing");
      expect(fw?.min).toBe(0);
      expect(fw?.max).toBe(16);
      expect(fw?.step).toBe(1);

      const diff = parsed.sliders.find((s) => s.key === "DIFF_POWER");
      expect(diff?.min).toBe(10);
      expect(diff?.max).toBe(100);
      expect(diff?.step).toBe(5);
    });
  });

  describe("parseAssettoCorsaModZip with encrypted data.acd", () => {
    it("transparently decrypts data.acd and extracts complete vehicle physics and garage sliders", async () => {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Add ui_car.json
      const uiCar = {
        name: "Aston Martin AMR25",
        brand: "Aston Martin",
        author: "ASW",
        specs: { weight: "800 kg" },
      };
      zip.file("content/cars/aston_martin_amr25/ui/ui_car.json", JSON.stringify(uiCar));

      // Build encrypted data.acd with car.ini, setup.ini, suspensions.ini, aero.ini
      const carId = "aston_martin_amr25";
      const key = deriveACDKey(carId);

      const filesToPack: Record<string, string> = {
        "car.ini": "[HEADER]\nVERSION=2\n\n[BASIC]\nTOTALMASS=800\n\n[FUEL]\nFUEL=142\n",
        "suspensions.ini": "[BASIC]\nWEIGHTRATIO=0.46\n",
        "setup.ini": `
[WING_1]
NAME=Front Wing
MIN=0
MAX=16
STEP=1

[WING_2]
NAME=Rear Wing
MIN=0
MAX=16
STEP=1

[ARB_FRONT]
NAME=Front ARB
MIN=80000
MAX=250000
STEP=10000
`,
        "aero.ini": "[WING_0]\nNAME=BODY\n\n[WING_1]\nNAME=FRONT\n\n[WING_2]\nNAME=REAR\n",
      };

      // Pack files into binary ACD structure
      const chunks: Buffer[] = [];
      for (const [name, content] of Object.entries(filesToPack)) {
        const nameBytes = Buffer.from(name, "ascii");
        const contentBytes = Buffer.from(content, "ascii");

        const headerBuf = Buffer.alloc(4 + nameBytes.length + 4);
        headerBuf.writeInt32LE(nameBytes.length, 0);
        nameBytes.copy(headerBuf, 4);
        headerBuf.writeInt32LE(contentBytes.length, 4 + nameBytes.length);
        chunks.push(headerBuf);

        const contentBuf = Buffer.alloc(contentBytes.length * 4);
        for (let i = 0; i < contentBytes.length; i++) {
          const decByte = contentBytes[i];
          const keyByte = key.charCodeAt(i % key.length);
          const encByte = (decByte + keyByte) & 0xff;
          contentBuf.writeInt32LE(encByte, i * 4);
        }
        chunks.push(contentBuf);
      }

      const acdBuffer = Buffer.concat(chunks);
      zip.file("content/cars/aston_martin_amr25/data.acd", acdBuffer);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const mockFile = new File([zipBlob], "asw-f1-2025-aston-martin-amr25.zip", {
        type: "application/zip",
      });

      const { parseAssettoCorsaModZip } = await import("@/lib/ac-mod-parser");
      const result = await parseAssettoCorsaModZip(mockFile);

      expect(result.carId).toBe("aston_martin_amr25");
      expect(result.name).toBe("Aston Martin AMR25");
      expect(result.brand).toBe("Aston Martin");
      expect(result.author).toBe("ASW");
      expect(result.weightKg).toBe(800);
      expect(result.frontWeightRatio).toBe(0.46);
      expect(result.fuelTankCapacity).toBe(142);
      expect(result.acdDecrypted).toBe(true);
      expect(result.hasAcdOnly).toBe(false);

      expect(result.sliders.length).toBe(3);
      expect(result.sliders.find((s) => s.key === "WING_1")?.name).toBe("Front Wing");
      expect(result.sliders.find((s) => s.key === "WING_2")?.name).toBe("Rear Wing");
      expect(result.sliders.find((s) => s.key === "ARB_FRONT")?.name).toBe("Front ARB");

      expect(result.aeroWings?.length).toBe(3);
      expect(result.aeroWings?.[0].name).toBe("BODY");
      expect(result.aeroWings?.[1].name).toBe("FRONT");
      expect(result.aeroWings?.[2].name).toBe("REAR");
    });
  });
});
