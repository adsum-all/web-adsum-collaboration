// Reference time zones offered when creating or editing an activity, identical to
// the back office (adsum-back-office/src/lib/fuseaux.ts). Default is the base's
// home GMT zone; pick the activity's own zone when it takes place elsewhere so
// members always see it at their own local time.
export const FUSEAUX: [string, string][] = [
  ["Africa/Abidjan", "Côte d'Ivoire (GMT)"],
  ["Europe/Paris", "France"],
  ["Europe/Brussels", "Belgique"],
  ["Africa/Dakar", "Sénégal"],
  ["Africa/Cotonou", "Bénin"],
  ["Africa/Lome", "Togo"],
  ["Africa/Ouagadougou", "Burkina Faso"],
  ["Africa/Niamey", "Niger"],
  ["Africa/Bamako", "Mali"],
  ["Africa/Douala", "Cameroun"],
  ["Africa/Lagos", "Nigéria"],
  ["Africa/Kinshasa", "RD Congo"],
  ["America/New_York", "États-Unis (Est)"],
  ["America/Toronto", "Canada (Est)"],
  ["Europe/London", "Royaume-Uni"],
];
