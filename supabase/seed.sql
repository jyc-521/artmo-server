-- 개발·시연용 기본 작품 3점. 실제 작품 500점은 npm run collect:artworks로 채운다.
-- 이미지 주소는 메트로폴리탄 미술관 Open Access(CC0) 작품이다. 여러 번 실행해도 중복되지 않는다.
insert into public.artworks (source, source_id, title, artist, year, medium, image_url, source_url, emotion_tags, description, is_public_domain)
values
  ('met', '436535', 'Wheat Field with Cypresses', 'Vincent van Gogh', '1889', 'Oil on canvas',
   'https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg',
   'https://www.metmuseum.org/art/collection/search/436535',
   array['벅참','자유','경이','희망'],
   '고흐가 생레미 요양원에 머물던 1889년 여름에 그린 작품이다. 소용돌이치는 하늘과 바람에 흔들리는 밀밭, 불꽃처럼 솟은 사이프러스가 살아 있는 듯한 리듬을 만든다.', true),
  ('met', '435809', 'The Harvesters', 'Pieter Bruegel the Elder', '1565', 'Oil on oak',
   'https://images.metmuseum.org/CRDImages/ep/web-large/DP119115.jpg',
   'https://www.metmuseum.org/art/collection/search/435809',
   array['나른함','평온','따뜻함','향수'],
   '한여름 밀 수확 장면을 그린 연작 중 하나다. 일하는 사람과 나무 그늘에서 쉬는 사람들, 멀리 펼쳐진 들판이 느긋한 오후의 공기를 전한다.', true),
  ('met', '437881', 'Young Woman with a Water Pitcher', 'Johannes Vermeer', 'ca. 1662', 'Oil on canvas',
   'https://images.metmuseum.org/CRDImages/ep/web-large/DP353257.jpg',
   'https://www.metmuseum.org/art/collection/search/437881',
   array['고요','평온','고독','그리움'],
   '창으로 들어오는 부드러운 빛 아래 한 여인이 창문을 열며 물병을 잡고 있다. 일상의 짧은 순간이 정지된 듯 고요하게 담겨 있다.', true)
on conflict (source, source_id) do nothing;
