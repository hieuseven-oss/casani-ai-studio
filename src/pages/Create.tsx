import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Image as ImageIcon, Sparkles } from 'lucide-react';
import {
  getProducts,
  saveProducts,
  getProjects,
  saveProjects,
  uid,
} from '../lib/store';
import { createProductWithImage } from '../lib/productService';
import { createProject } from '../lib/projectService';

const spaces = ['Kitchen', 'Dining Room', 'Living Room', 'Bedroom', 'Hotel', 'Villa'];
const styles = ['Modern', 'Luxury', 'Minimal', 'Contemporary', 'Classic'];
const moods = ['Warm', 'Elegant', 'Dramatic', 'Natural', 'Premium'];
const ratios = ['1:1', '4:5', '9:16', '16:9'];

const demo = [
  'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=85',
];

export default function Create() {
  const nav = useNavigate();

  const [img, setImg] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [space, setSpace] = useState('Kitchen');
  const [style, setStyle] = useState('Luxury');
  const [mood, setMood] = useState('Warm');
  const [ratio, setRatio] = useState('4:5');
  const [loading, setLoading] = useState(false);

  function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    setFile(selectedFile);

    const reader = new FileReader();

    reader.onload = () => {
      setImg(String(reader.result));
    };

    reader.readAsDataURL(selectedFile);
  }

  async function generate() {
    if (!file || !img || !name.trim()) {
      alert('Hãy tải ảnh và nhập tên sản phẩm.');
      return;
    }

    setLoading(true);

    try {
      // 1. Upload ảnh thật + lưu sản phẩm vào Supabase
      const {
        product,
        previewUrl,
      } = await createProductWithImage({
        sku,
        name,
        file,
      });

      const productId = product.id;

      // 2. Tạo project thật trong Supabase
      const supabaseProject = await createProject({
        productId,
        space,
        style,
        mood,
        ratio,
      });

      // 3. Mirror vào localStorage để các màn hiện tại vẫn hoạt động
      saveProducts([
        ...getProducts(),
        {
          id: productId,
          sku: sku || 'CAS-' + Date.now().toString().slice(-5),
          name,
          imageUrl: previewUrl,
          category: 'Lighting',
          createdAt: new Date().toISOString(),
        },
      ]);

      // 4. Thử gọi AI Edge Function
      let outputs: string[] = demo;

      try {
        const res = await fetch('/functions/v1/generate-visual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_url: previewUrl,
            space,
            style,
            mood,
            ratio,
            name,
          }),
        });

        if (res.ok) {
          const data = await res.json();

          if (Array.isArray(data.images) && data.images.length) {
            outputs = data.images
              .map((x: any) => x.url || x)
              .slice(0, 4);
          }
        }
      } catch {
        // Giữ demo images cho đến khi Edge Function được deploy.
      }

      // 5. Giữ project local hiện tại để Results/Dashboard tiếp tục chạy
      const id = supabaseProject.id;

      saveProjects([
        ...getProjects(),
        {
          id,
          productId,
          productName: name,
          space,
          style,
          mood,
          ratio,
          createdAt: new Date().toISOString(),
          outputs,
        },
      ]);

      nav('/results/' + id);
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : 'Không thể lưu sản phẩm vào Supabase.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="pageTitle">
        <p className="eyebrow">NEW CAMPAIGN</p>
        <h1>Create a new visual</h1>
        <p>
          Start with the real product image. Casani AI Studio builds the
          surrounding advertising scene.
        </p>
      </header>

      <div className="createLayout">
        <section className="panel">
          <h2>1. Product</h2>

          <label className={'drop ' + (img ? 'hasImage' : '')}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={upload}
            />

            {img ? (
              <img src={img} alt="Product preview" />
            ) : (
              <>
                <Upload size={30} />
                <b>Drop product photo here</b>
                <span>JPG, PNG or WEBP · phone photo is fine</span>
              </>
            )}
          </label>

          <div className="two">
            <label>
              SKU
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="CL-2088"
              />
            </label>

            <label>
              Product name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Luna Pendant Light"
              />
            </label>
          </div>
        </section>

        <aside className="config panel">
          <h2>2. Creative direction</h2>

          <Pick
            title="Space"
            items={spaces}
            value={space}
            set={setSpace}
          />

          <Pick
            title="Style"
            items={styles}
            value={style}
            set={setStyle}
          />

          <Pick
            title="Mood"
            items={moods}
            value={mood}
            set={setMood}
          />

          <Pick
            title="Format"
            items={ratios}
            value={ratio}
            set={setRatio}
          />

          <button
            className="btn primary wide"
            onClick={generate}
            disabled={loading}
          >
            {loading ? (
              <>
                <ImageIcon size={18} />
                Saving product...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generate 4 visuals
              </>
            )}
          </button>

          <small>
            Product image is saved to Supabase. AI generation will be connected
            in the next stage.
          </small>
        </aside>
      </div>
    </>
  );
}

function Pick({
  title,
  items,
  value,
  set,
}: {
  title: string;
  items: string[];
  value: string;
  set: (v: string) => void;
}) {
  return (
    <div className="pick">
      <b>{title}</b>

      <div className="chips">
        {items.map((x) => (
          <button
            className={value === x ? 'selected' : ''}
            onClick={() => set(x)}
            key={x}
            type="button"
          >
            {x}
          </button>
        ))}
      </div>
    </div>
  );
}
