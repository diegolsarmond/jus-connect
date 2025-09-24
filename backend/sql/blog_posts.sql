CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    content TEXT,
    author TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    read_time TEXT NOT NULL,
    category INTEGER NOT NULL,
    image TEXT,
    slug TEXT NOT NULL UNIQUE,
    tags TEXT[] NOT NULL DEFAULT '{}',
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT blog_posts_categories_fk FOREIGN KEY (category) REFERENCES public.categorias(id)
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON public.blog_posts (published_at DESC, created_at DESC);
