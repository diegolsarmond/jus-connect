import { Request, Response } from 'express';
import { createTag as createTagService, deleteTag as deleteTagService, listTags as listTagsService, updateTag as updateTagService } from '../services/tagService';

export const listTags = async (_req: Request, res: Response) => {
  try {
    const tags = await listTagsService();
    res.json(tags);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTag = async (req: Request, res: Response) => {
  const { key, label, example, group_name } = req.body;
  try {
    const tag = await createTagService({ key, label, example, group_name });
    res.status(201).json(tag);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTag = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { key, label, example, group_name } = req.body;
  try {
    const tag = await updateTagService(id, { key, label, example, group_name });
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    res.json(tag);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTag = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const deleted = await deleteTagService(id);
    if (!deleted) return res.status(404).json({ error: 'Tag not found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
