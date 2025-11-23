# Database Migration Instructions

## Migration 1: Add document_id column to summaries table

If you're seeing the error: `column summaries.document_id does not exist`, you need to run this migration.

## Migration 2: Add language column to documents table

If you're seeing the error: `column documents.language does not exist`, you need to run this migration.

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migrations in order:
   - First, copy and paste the contents of `migration-add-document-id.sql` and click **Run**
   - Then, copy and paste the contents of `migration-add-language-column.sql` and click **Run**

### Option 2: Using psql command line

```bash
psql -h your-db-host -U postgres -d postgres -f supabase/migration-add-document-id.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migration-add-language-column.sql
```

### Option 3: Using Supabase CLI

```bash
supabase db reset  # This will apply all schema changes from schema.sql
# OR create individual migrations
supabase migration new add_document_id_to_summaries
# Copy migration SQL into the new migration file
supabase migration new add_language_to_documents
# Copy migration SQL into the new migration file
supabase db push
```

### What the migrations do:

**Migration 1 (migration-add-document-id.sql):**
1. Adds the `document_id` column to the `summaries` table if it doesn't exist
2. Creates a partial unique index on `(document_id, user_id)` to ensure one summary per user per document
3. Creates a partial unique index on `(video_id, user_id)` to ensure one summary per user per video

**Migration 2 (migration-add-language-column.sql):**
1. Adds the `language` column to the `documents` table if it doesn't exist
2. This column stores the ISO 639-1 language code (e.g., 'en', 'nl', 'de') detected from the document text

After running both migrations, the document features (summaries, language detection, text analysis) should work correctly.

