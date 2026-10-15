# Registry format repair: review list (MHH-003)

Built 2026-10-15 from the live Registry. Nothing changes until the owner runs
`registry_format_repair_2026_10.sql` (dry run first). Owner rulings Q23, Q24, Q25.

> **Before you run**
>
> 1. Paste migration 233 first (and 234). The repair stops with a message if 233 is missing: it records old page addresses so links keep working.
> 2. Run `registry_format_repair_2026_10_dryrun.sql`. It changes nothing; its numbers should match the ones below.
> 3. Run `registry_format_repair_2026_10.sql`. If any statement errors in the SQL editor, run `ROLLBACK;` before trying again.
> 4. Pages are cached for up to an hour, so the changes appear on the site within the hour.

## What the repair does (what the dry run will show)

1. **Colour descriptions** that start lowercase get a capital first letter: 4015 rows ("red chestnut" → "Red chestnut").
2. **Years stored as text** become numbers: 1729 values (start and end years counted separately) on 1662 rows. The dry run counts values. Nothing visible changes.
3. **Names one or two letters apart** merge into one spelling: 12 pairs (below), touching 21 rows (a row counts once even if its maker and artist both change; 9 of them have the old spelling in the sculptor field, which the Registry also reads). Known-correct spellings win; otherwise the more common one does. The less common spelling's pages forward to the kept one.
4. **Titles ending in punctuation**: 272 rows (below). Sets keep their roster and lose only the final period; other titles keep the name and move the description into the release's notes.

After the run, the final check's "titles ending in punctuation" should read about 7, not 0: titles that end in an abbreviation ("Co.", "Jr.", "I.C.E.") keep their period on purpose.

## 3. Names

| Keep | Rows | Merge in | Rows | Check |
|---|---|---|---|---|
| Brigitte Eberl | 362 | Brigette Eberl | 3 |  |
| D'Arry Jone Frank | 41 | D'Arry Jones Frank | 3 | **Please confirm**: the records don't settle which spelling is right |
| Tanya Baneman | 16 | Tanya Banemann | 1 |  |
| Tanya Baneman | 16 | Tanga Bannemann | 1 |  |
| Kristina Katunina | 16 | Kristina Kantunina | 4 |  |
| Melody Peña | 19 | Melody Pena | 1 |  |
| Elżbieta Zarzecka | 4 | Elzbieta Zarzecka | 1 |  |
| Sandra Winter | 2 | Sandra Winters | 1 | **Please confirm**: the records don't settle which spelling is right |
| Mariah Hjerppe | 2 | Maria Hjerppe | 1 |  |
| Luis M. Aguilar | 2 | Luis Agular | 1 |  |
| Maggie Jenner-Bennett | 2 | Maggie Jenner-Bennet | 2 |  |
| Pamela du Boulay | 1 | Pamela Du Boulay | 3 | Known correct spelling |

Rows: catalog rows naming that spelling as maker, artist, manufacturer or sculptor.

If the kept spelling is itself the typo for any pair, say which and it will be flipped.

Separate question, not merged: "Maggie Jenner-Bennett" may be the same artist as "Maggie Bennett". Say if they are one person.

## 4. Titles

Many of these "titles" are a run description rather than a name ("BreyerFest Special Run (1,113 made) Split run of …"); the March import put the source's notes where the name should be. This repair only tidies them as listed. Giving those releases real names is a separate job; say if you want it ticketed.

Titles whose "With …" part names a mold are treated as sets and keep it: mold pages read it to list the sets a mold was sold in. A mold name counts when it appears with its own capitals as whole words ("With Rojo" counts; "foal blanket" is not the Foal mold).

2 moved descriptions mention a mold only as a cross-reference (no "with", so mold pages never read them; nothing is lost): "Same pattern as #175 Indian Pony. See also Ford Motor Company Running Foal."; "Note the Appaloosa Performance Horse model standing in for the actual Stud Spider sold."

### Name kept, description moved to notes (59)

| Title becomes | Notes get |
|---|---|
| Just About Horses (1,500 made) | With Certificate of Authenticity. |
| QVC | With hang tag. Model shown has aftermarket base. |
| Joey's Pony Cart | With ceramic doll, black leather harness, wood and metal cart. On wood base with Plexiglas cover. |
| Hoofbeats & Maple Treats (25 made) Table centerpiece model with various Halloween costumes, each unique | Costume styles were: pumpkin, vampire, scarecrow, spider and witch. |
| Let's Go Camping | With doll, Beagle, camping accessories. |
| Test Model (1 made) | With Certificate of Authenticity. Painted by Tom Bainbridge. |
| Horses International (1,000 total made) Variation | These models appear to be #156 with mane/tail repainted. |
| Open Top Buggy | With cart, black leather harness, in clear display case. |
| Design Your Own Breyer (1 made) | With Certificate of Authenticity. Colorway modeled on Apollo. |
| Ford Motor Company Not on base, same as below otherwise | Same pattern as #175 Indian Pony. See also Ford Motor Company Running Foal. |
| Glamour Girls Ranch with Horse and Rider | With rider, barn, and accessories. |
| Sears Holiday Catalog Typically paler and creamier than #222 | Some with black hooves. |
| Classics Pet Sitter | With 6" articulated and fully clothed doll, Beagle, cat, foal blanket, water bowl, brush and ball. |
| Vanity | With neck ribbon. |
| BreyerFest Special Run (1,113 made)Split run of Black Pinto, Buckskin Pinto and Blue Pinto “BreyerFest 2025” stamp on belly | In-person purchase only. |
| BreyerFest Special Run (2,300 sets made) “BreyerFest 2025” stamp on belly | In-person purchase only. |
| Let's Go Racing | With race tack, jockey doll and color poster. |
| Black Silk | With neck ribbon. |
| Utterly Horses (1 made) | With a clear acrylic base engraved with Lloyds TSB logo. Prototype for bank giveaway that did not happen. |
| BreyerFest Special Run (1,020 made)Split run of 6 color variations | Deco is glossy only, Blue Roan is matte only, other 4 colors glossy & matte versions. “BreyerFest 2025” stamp on belly. |
| Cutting Horse | With cowboy, Western saddle and bridle, Calf, and 4 sections of fencing. |
| BreyerFest Limited Edition (2,250 made) Split run of Glossy & Matte “BreyerFest 2025” stamp on belly | Online purchase only. |
| Utterly Horses (1 made) | With clear acrylic base engraved with Lloyds TSB logo. Prototype for bank giveaway that did not happen. |
| Similar in color to older sorrel #52 Five Gaiter | Source and quantity unknown. |
| QVC Same as #474 | With Certificate of Authenticity. |
| Bayberry and Roses | With green and red ribbons with intricate gold trim, holiday flora lays in a wreath. |
| Cloud | With neck ribbon. |
| Vintage Collectors Club (1,200 sets made) "Vintage Collector Club 2025" stamp on belly | Came with Certificate of Authenticity and booklet featuring the history and significance of model. |
| Similar in color to older sorrel #52 Five Gaiter | Source and quantity unknown. |
| Black Jack | With neck ribbon. |
| Sears Holiday Catalog Somewhat paler and creamier than #221 | Some with grey hooves. |
| Riding Camp | With barn, 2 cavalettis, easel and 3 easel cards. |
| BreyerWest, Breyer Tour Events (500 made) "2006 Breyer Tour Limited Edition" stamped on belly in gold | With velvet bag and Certificate of Authenticity. |
| BreyerFest Special Run (1,112 made)Split run of Black Pinto, Buckskin Pinto and Blue Pinto “BreyerFest 2025” stamp on belly | In-person purchase only. |
| Similar in color to older sorrel #52 Five Gaiter | Source and quantity unknown. |
| BreyerFest Special Run (384 made)Split run of 6 color variations | Deco is glossy only, Blue Roan is matte only, other 4 colors glossy & matte versions. “BreyerFest 2025” stamp on belly. |
| Given to singer Hunter Hayes by Breyer | Only one made. |
| Holiday Pony Playset "Mia" | With bareback pad, wreath of roses, unicorn halter, rider in pjs with stocking full of carrots. |
| Charm with Canterwood Crest's Take the Reins Includes Take the Reins paperback novel by Jessica Burkhart | Some autographed by author. |
| Aristocrat with Canterwood Crest: Chasing Blue Includes Chasing Blue paperback novel by Jessica Burkhart | Some autographed by author. |
| BreyerFest Limited Edition (750 made) Split run of Glossy & Matte “BreyerFest 2025” stamp on belly | Online purchase only. |
| Vintage Collectors Club (1,200 sets made) "Vintage Collector Club 2025" stamp on belly | Came with Certificate of Authenticity and booklet featuring the history and significance of model. |
| "Why My Favorite Horse Would Love to be a Breyer Model” essay contest(1 made) 1 of 2 Runner-Up Prize winners, this model will only be a OOAK Test | Only the Grand Prize winner was used as an actual release run. |
| Vintage Collectors Club (1,200 made) "Vintage Collector Club 2025" stamp on belly | Came with Certificate of Authenticity and booklet featuring the history and significance of model. |
| Barrel Racer with Barrel | With barrel. |
| Renaissance Horse & Rider | With 8” articulated doll complete with traditional costume, saddle, bridle and breastcollar. |
| BreyerFest Special Run (1,150 made)Split run of 6 color variations | Deco is glossy only, Blue Roan is matte only, other 4 colors glossy & matte versions. “BreyerFest 2025” stamp on belly. |
| BreyerFest Special Run (1,163 made)Split run of Dappled Gray, Dappled Grey Sabino and Grey Holographic “BreyerFest 2025” stamp on belly | In-person purchase only. |
| Kuchi | With gelding anatomy. |
| QVC 2002 printed on belly | With hang tag. |
| BreyerFest Special Run (1,162 made)Split run of Dappled Gray, Dappled Grey Sabino and Grey Holographic “BreyerFest 2025” stamp on belly | In-person purchase only. |
| Open Top Buggy | With cart, black leather harness, Brenda doll, in clear display case. |
| Appears to be a re-release of 59197, using an older Country Stable Set box | Found at Big Lots in 2011 but (c)2010 on box. |
| Deluxe Kid's Club | With blanket, booklet, "Young Rider" magazine subscription. |
| Horsepower! Buckboard Wagon | With horse, harness, buckboard wagon, two pumpkins, bale of hay and basket of apples. |
| Haunted Hay Ride | With harness, wagon, driver, pumpkins, bucket of apples, Wolf. |
| Stablemates Tack Shop | With horse care products, saddle and bridle racks, boots, brushes, buckets, model with brown English tack. |
| Country Wagon | With Rabbit, Pig, Hen, and Goat, blue ribbon, wagon, harness, and fencing. |
| JCPenney Holiday Catalog Same as #66 | Note the Appaloosa Performance Horse model standing in for the actual Stud Spider sold. |

### Sets: roster kept, final period dropped (156)

| Title becomes | Notes get |
|---|---|
| Stablemates Horse Lover's Collection 10 Horse Shadow Box Set With American Saddlebred, Clydesdale, Friesian, Para Dressage, Paso Fino, Standardbred, Standing Stock Horse, Trotting Foal, Warmblood |  |
| Clydesdale Gift Set With Clydesdale Mare, green felt with white cloth tape blanket |  |
| My Dream Horse - Horse Family Painting Kit With unpainted Cantering Warmblood, Warmblood, three paints and brushes |  |
| Cherry Creek Western Ranch With Cantering Warmblood, Standing Stock Horse, three barrels, four pieces of fencing, a water trough, Border Collie, Cow, Calf, two articulated figures, two western saddles and bridles, a hitching post, hay bale and play mat |  |
| New Arrival With American Saddlebred, fencing, tack trunk, hay manger, feed bag, and bucket |  |
| Jumping to Conclusions Lisa and Prancer Play Set With Warmblood, two English bridles, two English saddles, log jump, timber jump, blanket, bag of oats, and feed bucket |  |
| San Domingo the Medicine Hat Stallion Model and Book Set With a paperback copy of Marguerite Henry's San Domingo The Medicine Hat Stallion |  |
| Dude Ranch Play Set With Appaloosa, Trotting Foal. campfire, lantern, water trough, hitching post, barrel, and corral fencing |  |
| Starlight Play and Activity Set With Morgan, stable, color and activity set |  |
| Breyer Kids Club Deluxe Gift Set With blanket and the "Welcome to the World of Breyer" booklet, packed in a drawstring backpack, subscription to Young Rider Magazine, BreyerHorses.com gift card |  |
| Model Horse Play Set and Activity Kit With materials to make a halter, lead rope, and several blankets that can be customized with colorful patches |  |
| Thoroughbred Lying and Standing Foals With Thoroughbred Lying Foal |  |
| Bonanza Ponderosa Ranch Set With the Ponderosa Ranch, four figures representing the main characters (Ben, Adam, Hoss, and Little Joe), Appaloosa, Cantering Warmblood, Morgan, Standing Stock Horse, Cow, a Running Calf, a Border Collie, 2 Western saddle and bridle sets, 4 pieces of fencing, and a 2-ft. x 2-ft. play mat |  |
| Learn to Draw Horses Activity Set With colored and graphite pencils, drawing and tracing paper and stencil sheet |  |
| Starlight Play & Activity Set With Morgan, stable, color and activity set |  |
| Patch Play & Activity Set With Thoroughbred, 24-page color and activity book, paints and brushes |  |
| Black Gold Model and Book Set With a paperback copy of Marguerite Henry's novel, Black Gold |  |
| Saddle Club Stablemate Collection With Arabian Mare, Citation, Native Dancer, Silky Sullivan, Swaps |  |
| Pony Club Two Piece Set With rider |  |
| Proud Arabian Mare Gift Set With blue/white halter, carrying case |  |
| Waiting For Santa Pony Gift Set With doll, pony blanket, 2 Mini Whinnies horses, sleeping bag with pillow |  |
| Western Play Set With articulated figure, fencing, trophy and ribbon, saddle and bridle, ground poles, cones, mailbox, and bridge |  |
| Set of 12 Miniatures With Arabian Mare, Arabian Stallion, Citation, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Silky Sullivan, Swaps, Thoroughbred Mare |  |
| Bitsy Breyer and Arabian Stallion Beach Set With doll, plastic bridle, surf board, comb |  |
| Stablemates Horse Lover's Collection 10 Horse Shadow Box Set With American Saddlebred, Appaloosa, Clydesdale, Friesian, Para Dressage, Paso Fino, Standardbred, Standing Stock Horse, Warmblood |  |
| Puppies and Foals Play Set With Cantering Foal, Scrambling Foal, Scratching Foal, Basset Hound, Begging Dog, water trough, fence |  |
| Stablemates Kittens and Foals Play Set With Standing Foal, Trotting Foal, Lying Foal, straw bed, 4-piece fencing, hay manger, Lying Cat, Sitting Cat, Standing Cat |  |
| Stablemates Collection With Arabian Mare, Citation, Native Dancer, Silky Sullivan, Swaps |  |
| Buffalo Bill Rough Rider Play Set With Warmblood, rider, wagon, hitching post, lantern, campfire |  |
| Set of 12 Miniatures With Arabian Mare, Arabian Stallion, Citation, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Silky Sullivan, Swaps, Thoroughbred Mare |  |
| Panuhu, Spotted Mustang Stallion and Honego, Foal With Rojo |  |
| Pony Palace Complete Gift Set With Bouncer, Deluxe Wood Barn, doll, and accessories |  |
| Classics Trail Ride Set With Western bridle, Western saddle, saddle pad, 6 inch rider doll |  |
| "Horspital" Play Set With American Saddlebred, blankets, corral fencing, green rubber hose, water trough, bucket, bale of hay, medical kit, pitchfork, ointment, and spray bottle |  |
| Stablemates Country Stable Set With Standardbred, red and white stable, fence, jump |  |
| Horse Trailer and Vet Gift Set With horse trailer, vet doll, accessories |  |
| Indian Pony and Leotie Gift Set With doll, Leotie, wearing a replica of Native American buckskin dress and with leather tack |  |
| Horspital With Paso Fino, foal blanket, fencing, water trough, hay bale, bucket and bandage box |  |
| Mudslinger Collectibulls Play Set With Appaloosa, Mudslinger, cowboy, fencing, hay manger, bale of hay, winning trophy |  |
| Picture Perfect Quarter Horse With disposable camera, flower box, background, a decorative photo frame and a 16-page instruction booklet |  |
| Fantasy Play Set With fairyland princess, a green Dragon, a crystal ball, treasure chest, and a mystical tree |  |
| Stablemates Dude Ranch Play Set With dude ranch sign, 4-piece fencing, hay bale, feed bag, pitchfork, lantern, Cantering Foal |  |
| Connoisseur Series (350 made) With Certificate of Authenticity. Showing color variations |  |
| The Mod Squad On keychain. With Appaloosa, Rearing Arabian, Draft Horse, Saddlebred |  |
| Thoroughbred Lying and Standing Foals With Thoroughbred Lying Foal |  |
| Pony Slumber Party Set With a 6" doll dressed for bed, two Mini Whinnies horses, and a sleeping bag with horse shaped pillow |  |
| Stablemate Assortment III With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Seabiscuit, Silky Sullivan, Swaps, Thoroughbred Mare |  |
| Bitsy Breyer and Arabian Stallion Beach Set With doll, plastic bridle, surf board, comb |  |
| Learn to Draw Horses Activity Set With colored and graphite pencils, drawing and tracing paper and stencil sheet |  |
| Back to School San Domingo With San Domingo the Medicine Hat Stallion paperback book |  |
| Stablemates Little Red Stable Set With Mule |  |
| Spirit: Stallion of the Cimarron Play Set With Rearing Arabian, tree, a blacksmith and a forge fire, hitching post. Replaced Native Dancer |  |
| Tractor Play Set With farmer, cowgirl, Quarter Horse, steer, llama, swan, Border Collie, hay bale and tractor |  |
| New Arrival Barn Stablemates Pocket Barn with Mare & Foal Set includes corral fencing, water trough and hay manger. Identical to #5918, above. With Paso Fino |  |
| Grooming Kit Gift Set With sweat scraper, currycomb, hoof pick, face brush, body brush, hoof polish, electric clippers, and mud scraper |  |
| Future Champion Show Set With Brenda Breyer, leather halter and lead |  |
| Black Beauty With a paperback version of Anna Sewell's novel Black Beauty |  |
| Classics Pony Games Set With English tack, rider, trophy |  |
| Classics Show Award Set With show blanket, halter, silver loving cup trophy and tricolor championship ribbon |  |
| 12-Piece Stablemates Set With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Saddlebred, Seabiscuit, Silky Sullivan, Swaps |  |
| Riegseckers, mail order companies (300-400 made) Sold separately or in a set with the with other two Reigseckers models |  |
| Picture Perfect Spotted Draft Horse With disposable camera, flower box, background, a decorative photo frame and a 16-page instruction booklet |  |
| Stablemates Collection With Arabian Mare, Citation, Native Dancer, Silky Sullivan, Swaps |  |
| Set of 12 Miniatures With Arabian Mare, Arabian Stallion, Citation, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Silky Sullivan, Swaps, Thoroughbred Mare |  |
| Classics Horse and Jump Set With green and white rail jump |  |
| Pony Care Set Doll with bay appaloosa Merrylegs, blanket, bucket, brush, spray bottle, tack box and food bag |  |
| Model Horse Customizing Kit With acrylic paints, brushes, mohair, and instructions. no mane, abbreviated tailbone |  |
| The Mod Squad On keychain. With Appaloosa, Rearing Arabian, Draft Horse, Saddlebred |  |
| North Pole Play Set With doll, antler headband, halter, saddlebags, Christmas list |  |
| Stablemates Assortment III With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Seabiscuit, Silky Sullivan, Swaps, Thoroughbred Mare |  |
| Stablemates Assortment IV With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Seabiscuit, Silky Sullivan, Swaps |  |
| Western Pony with Grooming Kit With vinyl blanket, toothbrush, white plastic comb, metal nail file, ballpoint pen |  |
| 12-Piece Stablemates Set With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Seabiscuit, Silky Sullivan, Swaps |  |
| Spanish Riding School of Vienna Gift Set With red bridle, saddle, and rider |  |
| Deluxe Animal Hospital With grey Standing Stock Horse and black Scrambling Foal, Donkey, Goat, Border Collie and Sitting Cat. Other accessories include a horse blanket, operating table, and a bandage box |  |
| Thoroughbred Lying and Standing Foals With Thoroughbred Lying Foal |  |
| Medieval Play Set With doll, removable decorated armor, tree, heraldic sign, chalice and treasure chest |  |
| Proud Arabian Mare Gift Set With red/white halter, carrying case |  |
| Holiday Ornament Craft Kit With Morgan, Warmblood, Trotting Foal, eyehook on back for hanging, paints and accessories |  |
| 12-Piece Stablemates Set With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Saddlebred, Seabiscuit, Silky Sullivan, Swaps |  |
| Mobile Rescue & Care Clinic With ladder, two chairs, water trough, feed bin, tack clips, Beagle and Silver Tabby |  |
| Grooming Kit Gift Set With sweat scraper, currycomb, hoof pick, face brush, body brush, hoof polish, electric clippers, and mud scraper |  |
| Appaloosa and Foal With Quarter Horse Stallion |  |
| Farm Animals Play Set With Cow, Hen and Chicks, Pig, Mule, Rabbit, Rooster, doll, water trough, corral, fencing, and hay bale |  |
| Indian Pony and Leotie Gift Set With doll, Leotie, wearing a replica of Native American buckskin dress and with leather tack and papoose |  |
| Clydesdale Gift Set With Clydesdale Foal, green felt with white cloth tape blanket |  |
| Bitsy Breyer and Arabian Stallion Beach Set With doll, plastic bridle, surf board, comb |  |
| Stablemates Assortment IV With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Seabiscuit, Silky Sullivan, Swaps |  |
| Bucking Bronco Set With cowboy rider, bareback rigging and cinch |  |
| Veterinary Care Gift Set With veterinarian doll, first aid kit, stethoscope, vet bag, preventative medicine tub, ointment and syringe |  |
| Classics Grooming Kit Gift Set With grooming box, hoof pick, curry, sweat and mud scrapers, hoof polish, two brushes, clippers |  |
| Roll and Go Western Set With ranch scene play mat, Running Calf, Border Collie, water trough and 4 pieces of fencing |  |
| Stablemate Assortment IV With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Seabiscuit, Silky Sullivan, Swaps |  |
| Horse and Foal Set With Thoroughbred |  |
| Deluxe Animal Hospital With Standing Stock Horse, Scrambling Foal, Donkey, Border Collie, Sitting Cat, horse blanket, operating table, and bandage box |  |
| Stud Spider Gift Set With Let's Go to the Races with the Appaloosas by Jim Brolin. Some 1977 sets came with leg wraps |  |
| Family Arabian Mare Sold singly or with Family Arabian Foal and Family Arabian Stallion |  |
| English Show Horse & Rider Set With doll, crop, and brown plastic English saddle and bridle |  |
| Proud Arabian Mare Gift Set With green/white halter, carrying case |  |
| Classics Animal Rescue Set With blanket, first aid kit, bucket and sponge, Welsh Corgi and Silver Tabby |  |
| VIP Access Pass ticket holders gift. With black velvet bag |  |
| My Dream Horse Customizing Kit With acrylic paints, brushes, mohair, and instructions. no mane, abbreviated tailbone |  |
| Buffalo Bill Rough Rider Play Set With Warmblood, rider, wagon, hitching post, lantern, campfire |  |
| Paint Your Own Horse Activity Kit With unpainted Arabian Stallion, paint, instructions |  |
| Stablemates Assortment IV With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Seabiscuit, Silky Sullivan, Swaps |  |
| Let's Go Riding - Western With Western saddle set with bridle, 8" articulated rider in Western riding outfit and cowboy hat |  |
| Annie Oakley Play Set With Swaps, Appaloosa, wagon, hay bale, harness, rider, Standing Dog, lantern |  |
| Princess Kayla Fantasy Adventure With Warmblood, queen figure, rider figure, removable wings, heraldic sign, treasure chest |  |
| Stablemates Pocket Barn with Mare & Foal Set includes Paso Fino, corral fencing, water trough and hay manger |  |
| The Mod Squad On keychain. With Appaloosa, Rearing Arabian, Draft Horse, Saddlebred |  |
| 12-Piece Stablemates Set With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Seabiscuit, Silky Sullivan, Swaps |  |
| Alano and Mateo With Rojo. Replaced by Duchess |  |
| Paint Your Own Horse Kit With unpainted Thoroughbred Stallion, paint, instructions |  |
| Stablemates Assortment III With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Seabiscuit, Silky Sullivan, Swaps, Thoroughbred Mare |  |
| Spirit: Stallion of the Cimarron Play Set With Appaloosa or Native Dancer, tree, a blacksmith and a forge fire, hitching post |  |
| Stablemate Assortment III With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Seabiscuit, Silky Sullivan, Swaps, Thoroughbred Mare |  |
| The Mod Squad On keychain. With Appaloosa, Rearing Arabian, Draft Horse, Saddlebred |  |
| Pony Palace Complete Gift Set With Newsworthy, Deluxe Wood Barn, doll, and accessories |  |
| 12-Piece Stablemate Set With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Seabiscuit, Silky Sullivan, Swaps |  |
| Dude Ranch Set With Appaloosa, Trotting Foal. campfire, lantern, water trough, hitching post, barrel, and corral fencing |  |
| Stablemates Horspital With Standing Foal, hose, bucket, medical box, ointment tube, spray bottle, grooming tote, shampoo bottles, two horse blankets and 4-pc fencing |  |
| Bonanza Ponderosa Ranch Set With the Ponderosa Ranch, four figures representing the main characters (Ben, Adam, Hoss, and Little Joe), Appaloosa, Cantering Warmblood, Morgan, Standing Stock Horse, Cow, a Calf, a Border Collie, Bull, 2 Western saddle and bridle sets, 4 pieces of fencing, and a 2-ft. x 2-ft. play mat |  |
| Model Horse Play Set and Tack Activity Set With materials to make your own western saddle and bridle |  |
| Stablemates Little Red Stable Set With Appaloosa, three stall barn that features a tack/storage area, four corral fences, jump, water trough and three race barrels |  |
| Sacred Medicine Hat Stallion and Grey Wolf With Wolf. Replaced by Duchess in 2003 |  |
| Deluxe Animal Hospital With grey Standing Stock Horse and black Scrambling Foal, Donkey, Goat, Border Collie and Sitting Cat. Other accessories include a horse blanket, operating table, and a bandage box |  |
| Halter and Blanket Kit With instructions, halter leather and chain, blanket material and misc. notions |  |
| Nekana and Rojo With Mesteño the Foal. Replaced by Ginger |  |
| Deluxe Animal Hospital With Standing Stock Horse, Scrambling Foal, Donkey, Border Collie, Sitting Cat, horse blanket, operating table, and bandage box |  |
| Family Arabian Foal Sold singly or with Family Arabian Mare and Family Arabian Stallion |  |
| Let's Go Riding - English With English saddle set with bridle, and an 8" articulated rider dressed in casual riding attire |  |
| Sears Holiday Catalog Some with red in nostrils. Model shown is from the Black Horse Ranch Model Horse Collection |  |
| Deluxe Farm Pocket Barn With Standing Foal, Mule, barn, doll, vet kit, pig, rooster, chicken, rabbit |  |
| Alano and Mateo With Rojo. Replaced Mesteño |  |
| New Arrival Play Set With Paso Fino, hay manger, water bucket, carrots, brush, straw, pitchfork, yellow corral fencing and tack trunk |  |
| Classics Grooming Kit Gift Set With stained wood grooming box and sweat scraper, curry comb, hoof pick, face brush, body brush, hoof polish, electric clippers and mud scraper |  |
| Tractor Play Set With farmer, cowgirl, Quarter Horse, Steer, Llama, Swan, Border Collie, hay bale and tractor |  |
| Stablemate Assortment III With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Seabiscuit, Silky Sullivan, Swaps, Thoroughbred Mare |  |
| Barrel Racing Set With saddle, bridle, doll, red barrel |  |
| 12-Piece Stablemate Set With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Saddlebred, Seabiscuit, Silky Sullivan, Swaps |  |
| Stablemates Horse Lover's Collection 10 Horse Shadow Box Set With American Saddlebred, Appaloosa, Clydesdale, Friesian, Para Dressage, Paso Fino, Standardbred, Trotting Foal, Warmblood |  |
| Stablemates Horse Lover's Collection 10 Horse Shadow Box Set With American Saddlebred, Appaloosa, Clydesdale, Friesian, Para Dressage, Paso Fino, Standing Stock Horse, Trotting Foal, Warmblood |  |
| Stablemates Gift Collection With Friesen, Mustang, Warmblood Jumper |  |
| Starlight and Carole Cross Country Set With doll, plastic English saddle and bridle, competitor's number, comb |  |
| 12-Piece Stablemates Set With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Saddlebred, Seabiscuit, Silky Sullivan, Swaps |  |
| Stablemates Horse Lover's Collection 10 Horse Shadow Box Set With American Saddlebred, Appaloosa, Friesian, Para Dressage, Paso Fino, Standardbred, Standing Stock Horse, Trotting Foal, Warmblood |  |
| Stablemates Kittens and Foals Play Set With Standing Foal, Trotting Foal, Lying Foal, straw bed, 4-piece fencing, hay manger, Lying Cat, Sitting Cat, Standing Cat |  |
| Riegseckers (200 made) Sold in set with other six Riegseckers models |  |
| Little Red Stable With Friesian, a tack/storage area, four corral fences, jump, water trough, and three race barrels |  |
| 12-Piece Stablemates Set With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Saddlebred, Seabiscuit, Silky Sullivan, Swaps |  |
| Blackjack Model & Book Set With Blackjack Dreaming of a Morgan Horse paperback novel, bridle |  |
| Vixen and Blitzen Holiday Mare and Foal Set With Running Mare, burgundy, black and white plaid blanket |  |
| 12-Piece Stablemates Set With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Quarter Horse Stallion, Seabiscuit, Silky Sullivan, Swaps |  |
| Lusitano Stallion and Foal Horse and Foal Set With Andalusian |  |
| Glitter and Gem With Warmblood Foal, with iridescent purple blanket with yellow trim |  |
| Stablemates Assortment III With Arabian Mare, Arabian Stallion, Citation, Draft Horse, Morgan Mare, Morgan Stallion, Native Dancer, Seabiscuit, Silky Sullivan, Swaps, Thoroughbred Mare |  |

### Final punctuation dropped only (57)

| Title becomes | Notes get |
|---|---|
| "Why My Favorite Horse Would Love to be a Breyer Model” essay contest(1 made) Grand Prize winner, this model is the original OOAK Test that would become a 2025 Fall Limited Edition |  |
| BreyerFest Special Run (1,063 made)Split run of Wedgewood Blue, Gold Charm and Silver Charm “BreyerFest 2025” stamp on belly |  |
| Test Run; Stand-in model to show the color for the upcoming Stock Horse Stallion of the same color |  |
| "Whiteware," either sold like this by Breyer or a factory escapee |  |
| BreyerFest Single Day Stablemate Available as a gambler's choice to General Admission and Online Stablemate Access ticket holders |  |
| Test Piece/Prototype (1 made) "Test" printed on bottom of tail |  |
| BreyerFest Celebration Horse, Not Produced, few models given to the horse's owner |  |
| Stablemates Fun Foal 5-piece Gift Pack Model only |  |
| CollectiBulls Rodeo Includes two cowboys, Appaloosa with saddle and bridle, Mudslinger and fencing |  |
| Just About Horses (1,000 made) Hand numbered and dated "1984" on belly |  |
| Stablemates Collector's Club Bonus Model Wings added |  |
| Model Horse Congress Possible small run of 20-30; existence not verified |  |
| Pet Groomer Includes 6" articulated doll, Welsh Corgi, Siamese Calico Cat, shampoo bottle, bucket and water trough |  |
| Kaibab Fifth in America the Beautiful series |  |
| BreyerFest Probably a variation on the gold version above |  |
| Bold Most came with coffee cup and portrait card |  |
| Montgomery Ward Holiday CatalogSame as #19841, sold separately from set |  |
| BreyerFest Single Day Stablemate Available as a gambler's choice to General Admission and Online Stablemate Access ticket holders |  |
| JCPenney Holiday Catalog Same pinto pattern as #229 |  |
| American Quarter Horse - Dun Best in Show, with mohair manes and tails, glass eyes, horse shoes, and a presentation base |  |
| Sears Holiday Catalog Model shown is from the Black Horse Ranch Model Horse Collection |  |
| Pippa Funnell's Primmore's Pride Includes softcover copy of the book Pride and Joy, written by Pippa Funnell |  |
| Found Horse - Stevie and Belle Play Set Includes Cantering Warmblood, articulated Stevie and Veronica figures, tree, fencing, brush tote, brush, two English saddles, and two English bridles |  |
| Breyer's website lists this as #6064, box reads #6052 |  |
| Premier CollectionSplit run: collectors had choice of receiving either matte or glossy |  |
| Same as #59 |  |
| Best Friends Includes Shetland Sheepdog, horse blanket, dog blanket, water trough and fencing |  |
| Picture Perfect Thoroughbred Includes disposable camera, flower box, background, a decorative photo frame and a 16-page instruction booklet |  |
| Hidalgo Porcelain Porcelain on base |  |
| Stablemates Collector's ClubGamblers choice between Black Rabicano and a micro run Chestnut Rabicano (217 pieces) |  |
| Stablemates Collectors ClubGamblers choice between a matte grullo overo pinto and a glossy solid grullo micro run (76 pieces) |  |
| McCormick Distilling Co. (200+ made) Model same as #205 |  |
| Breyer's website lists this as #6062, box reads #6052 |  |
| JCPenney Holiday Catalog Hair color varies, with medium purple, a lighter, pinker version of the above, and strawberry blonde known |  |
| BreyerFest Special Run (1,062 made)Split run of Wedgewood Blue, Gold Charm and Silver Charm “BreyerFest 2025” stamp on belly |  |
| Wild Animal Series (750 made) "Wild Animal Series Limited Edition" stamped on belly |  |
| Premier CollectionOne glossy version was made and given to sculptor Kelly Sealey |  |
| First Competitor Came with brown leather English jumping saddle, brown cord and leather bridle, blue quilted saddle pad |  |
| Premier Collection (1 made) On wooden base |  |
| New Arrival at the Barn - Deluxe Horse & Foal Set Includes Jet Run and Trotting Stock Horse Foal, 6" articulated doll, halter, foal blanket, fencing, rake, shovel, bucket and water trough |  |
| Graceland Stables Play Set Includes Shetland Pony, Appaloosa, cardboard Graceland Stables, miniature Graceland blanket, hay bale, water trough, fencing and grooming box |  |
| Breyer's website lists this as #6062, box reads #6052 |  |
| Classics Art Class Set Includes 6" articulated and fully clothed doll, Cantering Morgan Mare, saddlebag art apron, paintbrush and paint tube |  |
| New Arrival at the Barn - Deluxe Horse & Foal Set Includes Jet Run and Trotting Stock Horse Foal, 6" articulated doll, halter, foal blanket, fencing, rake, shovel, bucket and water trough |  |
| Premier CollectionOne glossy version was made and given to sculptor Kelly Sealey |  |
| Fall Limited Edition(2,500 made) Grand Prize winner of the "Why My Favorite Horse Would Love to be a Breyer Model” essay contest |  |
| Stablemates Collector's Club(217 made) Gamblers choice between Black Rabicano and a micro run Chestnut Rabicano (217 pieces) |  |
| Arabian - Dapple Bay Best in Show: features mohair manes and tails, glass eyes, horse shoes, and a presentation base |  |
| Montgomery Ward Holiday Catalog Same as #216 |  |
| Kuchi Corrected to mare anatomy |  |
| JCPenney Holiday Catalog (8,000 made) Uncommon version with star shown |  |
| Seen in the BreyerFest Collector's Club tent |  |
| Noche Buena Decorated with red poinsettias and gems, wears a jeweled saddle resting on a poinsettia pad and gold halter with jewel details |  |
| Possibly a very limited production run or test run |  |
| An unknown number were handed out at the BreyerFest craft tent |  |
| Breyer's website lists this as #6064, box reads #6052 |  |
| Samirah's Ride Includes paperback version of Samirah's Ride |  |
