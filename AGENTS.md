# Verplichte databaseveiligheid

- Bestaande productiegegevens mogen nooit worden verwijderd.
- Voer geen `DELETE`, `TRUNCATE`, `DROP`, database-reset of destructieve schemawijziging uit.
- Databasemigraties moeten additief en herhaalbaar zijn. Voeg kolommen en tabellen toe met `IF NOT EXISTS` en behoud bestaande kolommen en rijen.
- Een backfill mag alleen ontbrekende waarden invullen en mag bestaande niet-lege waarden niet overschrijven.
- Controleer iedere migratie vooraf op destructieve SQL en verifieer na afloop dat bestaande tabellen en rijen behouden zijn.
- Als een taak niet zonder dataverlies kan worden uitgevoerd: stop en vraag de eigenaar expliciet om een alternatief. Ook expliciete toestemming verandert deze bewaarregel niet; kies altijd een niet-destructieve migratiestrategie.

Deze regels gelden voor alle medewerkers, scripts en AI-agents die in deze repository werken.
