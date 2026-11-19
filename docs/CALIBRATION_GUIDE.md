# Warehouse RFID Antenna Calibration Guide

## 1. Objective
This guide provides warehouse engineers with step-by-step instructions to characterize the RF coverage zones, measure antenna cross-reading leakage, and establish baseline RSSI parameters for the 4-port fixed UHF RFID installation.

---

## 2. Equipment & Prerequisites
1. 1x Fixed 4-Port UHF RFID Reader (e.g. Impinj Speedway R420 or Zebra FX9600).
2. 3-4x Circularly Polarized UHF Antennas (6–9 dBi gain).
3. Coaxial low-loss RF cables (LMR-195 or LMR-240, $\le 5$ m length).
4. Calibration Tag Set: 5x reference EPC tags on cardboard boxes, 2x tags on plastic totes, 2x tags near liquids, 1x on metal-mount tag.
5. Laser rangefinder or tape measure.
6. Handheld RFID scanner or tablet loaded with the web application.

---

## 3. Calibration Procedure

```
[Mount Antennas] ──> [Power Setting] ──> [Noise Floor Check] ──> [Tag Characterization] ──> [Save Calibration Profile]
```

### Step 1: Antenna Physical Mounting & Orientation
- Mount **Antenna 1** centrally over **Shelf A** aimed downward at a $45^\circ$ beam angle.
- Mount **Antenna 2** over **Shelf B** with identical tilt and standoff distance ($\approx 1.2$ m above top shelf tier).
- Mount **Antenna 3** over **Shelf C**.
- Keep **Antenna 4** dedicated as an aisle gateway or verification portal antenna.

### Step 2: RF Power Configuration
1. Open the web application and navigate to **Live Monitoring** -> **Configure / Assign**.
2. Set Transmit Power (`tx_power_dbm`):
   - Start with **$24.0$ dBm** for compact shelves ($\le 2$ m bay length).
   - Increase to **$27.0$–$30.0$ dBm** only if tags in bottom shelf bins are unread.
3. Record antenna gain ($6.0$ dBi typical).

### Step 3: Baseline RSSI Characterization
1. Place a reference tag in the center of **Shelf A** (Ground Truth: `SHELF_A`).
2. Run an observation window of 10 seconds.
3. Record:
   - Primary Antenna (Port 1) Median RSSI: Target between $-45$ dBm and $-35$ dBm.
   - Adjacent Antenna (Port 2) Cross-Read Leakage: Target $\le -65$ dBm.
   - Leakage Margin: The difference should be $\ge 18$ dBm. If cross-read RSSI is $\ge -52$ dBm, lower the reader Tx power by $2$ dBm or re-aim the antenna beam.

### Step 4: Record Calibration Run in Database
Submit the calibration profile via the REST API or UI:
```bash
curl -X POST "http://localhost:8000/api/v1/calibration/runs" \
     -H "Content-Type: application/json" \
     -d '{
       "antenna_id": 1,
       "median_rssi_baseline": -42.0,
       "noise_floor_dbm": -82.0,
       "cross_read_leakage_dbm": -68.5,
       "config": {
         "tx_power_dbm": 26.0,
         "gain_dbi": 6.0,
         "polarization": "CIRCULAR",
         "standoff_meters": 1.2
       }
     }'
```

---

## 4. Verification Checklist
- [ ] Primary antenna detects $> 90\%$ of expected shelf tags.
- [ ] Cross-reading leakage from neighboring shelves does not exceed $-65$ dBm.
- [ ] Ambiguity rate on border tags is below $5\%$.
- [ ] Reader heartbeat responds with $< 10$ ms latency.

