# Sless Studio: Replit compatibility assessment

## Conclusion

Replit Reserved VM supports the architecture, but the uploaded application is
not yet verified as a complete running deployment. Do not describe the smallest
VM as load-tested or promise its monthly cost covers the workload.

No application was installed, published, or connected to paid services during
this assessment. The uploaded archive and current website were unchanged.

## Checks performed

- Read the supplied package manifest, server environment validation, MongoDB
  client, media storage, audio worker, scheduler, and FFmpeg implementation.
- Confirmed the pinned Next.js, React, Auth.js and ffmpeg-static package versions
  exist in the npm registry. Next.js requires Node >=20.9; this development
  workspace runs Node 24.22.1. This is not a dependency installation or build.
- Official Replit documentation confirms Reserved VM supports always-on
  background processing. Durable state must not depend on the deployment's
  writable filesystem.
- Ran the uploaded audio filter function using the existing system FFmpeg
  7.1.1 in an isolated temporary directory. Its original `aresample=ocl=mono`
  option failed with "Option not found".
- Tested a runtime-only replacement, `aresample=out_chlayout=mono`.
  Standard and strong cleanup chains, including de-clipping, each successfully
  processed 300 seconds of synthetic 48 kHz mono tone into AAC:
  standard 52.6 seconds; strong 53.6 seconds.

These timings are development-workspace measurements, not published-VM
benchmarks. The workspace has approximately 8 GiB RAM and other running
services. No representative wrestling clip, video remux, concurrent workload,
AI restoration, or AI isolation was tested. Synthetic-tone success confirms
filter execution, not restoration quality.

## Changes required before a reliable launch

1. Replace the Vercel-only production cron assumption with a production worker
   and periodic reconciliation suitable for Reserved VM. The supplied in-process
   periodic scheduler is explicitly development-only. Do not simply enable its
   five-second overlapping tick in production.
2. Bound audio-job concurrency across request-triggered work and the worker.
   Review job lease renewal and ownership checks: the supplied lease expires
   after 12 minutes, while external processing plus local stages can run longer.
3. Select and verify a compatible FFmpeg binary/filter combination.
4. Keep MongoDB as the existing database technology and connect a durable
   replica-set service; do not run the development in-memory database in production.
5. Connect durable media storage. The supplied code supports R2; its local-media
   fallback is development-only and unsuitable for permanent customer outputs.
6. Configure real email, Higgsfield and optional audio providers. The application
   currently requires its Stripe and R2 settings in production even when checkout
   is intended to remain inactive. Existing differently named credentials must
   not be assumed to be configured for this app.
7. Build and start the complete app, verify authentication and job recovery,
   then benchmark representative clips on the selected published machine
   before claiming production capacity.

The exact Studio-specific secret names checked were absent. No credential
values were read or printed.

## Sizing and cost boundary

The smallest quoted Reserved VM is 0.5 vCPU / 2 GiB at $15/month. It has not
been proven sufficient. A 1 vCPU / 4 GiB machine is a reasonable candidate
for initial one-job-at-a-time measurement, not a validated requirement or
approved purchase. Media-copy code can buffer large responses, making
concurrency control important even when AI inference happens externally.

Database, storage, email, AI-provider charges, network transfer and any
platform subscription are separate from the base machine quote.

## References

- https://docs.replit.com/features/publishing/deployment-types
- https://docs.replit.com/features/publishing/machine-configuration
- https://docs.replit.com/billing/deployment-pricing
- https://docs.replit.com/billing/aug-cloud-billing-updates
