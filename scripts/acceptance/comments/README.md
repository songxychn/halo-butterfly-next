# Retired official-comment business acceptance tools

The theme now uses Halo's `<halo:comment>` extension point. Current validation covers
subject identity, availability, navigation and theme appearance; captcha, moderation,
upload expiry and storage garbage collection belong to the official plugin.

The historical harness, ownership checks and recovery code are preserved at
[742b1d4](https://github.com/songxychn/halo-butterfly-next/tree/742b1d4b4702d91ef909a2d5976267665c3de6e5/scripts/acceptance/comments).
Existing reports under `docs/validation/` remain historical evidence. Do not start new
plugin-business matrices as a theme release requirement.

This removal changes only this checkout. It does not stop an existing observation,
remove its runtime, release its lock or authorize cleanup of its fixtures. Complete or
recover an existing observation using its original checkout/frozen tools and ownership
guards; do not substitute current-source tools into that run.
