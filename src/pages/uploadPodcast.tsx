import { useState, useRef, useContext, useCallback, useEffect, ChangeEvent } from "react";
import ArDB from "ardb";
import { appContext } from "../utils/initStateGen";
import { BsArrowRightShort } from "react-icons/bs";
import {
  FEE_MULTIPLIER,
  SHOW_UPLOAD_FEE,
  arweave,
  deployContract,
  queryTXsByAddress,
  TREASURY_ADDRESS,
} from "../utils/arweave";
import LANGUAGES from "../utils/languages";
import {
  processFile,
  userHasEnoughAR,
  fetchWalletAddress,
  calculateStorageFee,
} from "../utils/shorthands";
import ArConnect from "../component/arconnect";
import { PhotoIcon } from "@heroicons/react/24/outline";

import Swal from "sweetalert2";
import { useTranslation } from "react-i18next";
import { UploadsList } from "../component/uploads_list";
import { useRecoilState, useSetRecoilState } from "recoil";
import { ContentType, uploadPercent } from "../atoms";
import Cropper from "react-easy-crop";
import getCroppedImg from "../utils/croppedImage";
import handler from "../services/services";
import { validateStrLength } from "../utils/uploadValidation";
import {
  PODCAST_NAME_MIN_LEN, PODCAST_NAME_MAX_LEN, PODCAST_DESC_MIN_LEN,
  PODCAST_DESC_MAX_LEN, PODCAST_AUTHOR_MIN_LEN, PODCAST_AUTHOR_MAX_LEN,
  PODCAST_LANG_MIN_LEN, PODCAST_LANG_MAX_LEN, PODCAST_CAT_MIN_LEN,
  PODCAST_CAT_MAX_LEN, IS_EXPLICIT_VALUES, 
  PODCAST_COVER_MIN_LEN, PODCAST_COVER_MAX_LEN, CONTENT_TYPE_VALUES
} from '../constants';

import { genNodeAPI } from 'arseeding-js';
import { CheckAuthHook } from "../utils/ui";
import useEthTransactionHook from "../utils/ethereum";

const ardb = new ArDB(arweave);

const UploadPodcastView = async () => {

  const appState = useContext(appContext);
  // remove state from here
  const [show, setShow] = useState(false);
  const [img, setImg] = useState();
  const [isUploading, setIsUploading] = useState(false);
  const [cost, setCost] = useState(0);
  const [eth, ar] = CheckAuthHook();
  const [data, isLoading, isSuccess, sendTransaction, error] = useEthTransactionHook();
  let finalShowObj = {};
  const [contentType_, setContentType_] = useRecoilState(ContentType);
  const podcastCoverRef = useRef();
  const { t, i18n } = useTranslation();
  const currentLanguage = LANGUAGES.find(
    (language) => i18n.language === language.code
  );
  const languages = currentLanguage?.languages || [];
  const categories = currentLanguage?.categories || [];

  const setPercent = useSetRecoilState(uploadPercent);

  const [podcastDescription_, setPodcastDescription_] = useState(null);
  const [podcastAuthor_, setPodcastAuthor_] = useState(null);
  const [podcastEmail_, setPodcastEmail_] = useState(null);
  const [podcastCategory_, setPodcastCategory_] = useState(null);
  const [podcastName_, setPodcastName_] = useState("");
  const [podcastCover_, setPodcastCover_] = useState(null);
  const [podcastLanguage_, setPodcastLanguage_] = useState(null);
  const [podcastExplicit_, setPodcastExplicit_] = useState(false);
  
  const uploadShow = async (show: any) => {
    Swal.fire({
      title: t("uploadshow.swal.uploading.title"),
      timer: 2000,
      customClass: "font-mono",
    });
    let contractId;

    let addr = await fetchWalletAddress();
    console.log("ADDRESSS");
    console.log(addr);
    const tx = await queryTXsByAddress(addr);

    console.log(tx);
    if (tx.length !== 0) {
      contractId = tx[0].id;
    }
    if (!contractId) {
      console.log("not contractId - deploying new contract");
      contractId = await deployContract(addr);
    }
    let input = {
      function: "createPodcast",
      name: show.name,
      contentType: "a",
      cover: show.cover,
      lang: show.lang,
      isExplicit: show.isExplicit,
      author: show.author,
      categories: show.category,
      email: show.email,
    };

    console.log(input);
    console.log("CONTRACT ID:");
    console.log(contractId);

    let tags = {
      Contract: contractId,
      "App-Name": "SmartWeaveAction",
      "App-Version": "0.3.0",
      "Content-Type": "text/plain",
      Input: JSON.stringify(input),
    };

    const interaction = await arweave.createTransaction({ data: show.desc });

    function addTags(interaction: any, tags: any) {
      for (const key in tags) {
        interaction.addTag(key, tags[key]);
      }
    }
    addTags(interaction, tags);

    interaction.reward = (+interaction.reward * FEE_MULTIPLIER).toString();
    await arweave.transactions.sign(interaction);
    await arweave.transactions.post(interaction);
    if (interaction.id) {
      Swal.fire({
        title: t("uploadshow.swal.showadded.title"),
        text: t("uploadshow.swal.showadded.text"),
        icon: "success",
        customClass: "font-mono",
      });
      console.log("INTERACTION.ID");
      console.log(interaction.id);
    } else {
      alert("An error occured.");
    }
  };

  const uploadToArweave = async (data: any, fileType: any, showObj: any) => {
    console.log("made it here, data is");
    console.log(data);
    arweave.createTransaction({ data: data }).then((tx) => {
      tx.addTag("Content-Type", fileType);
      tx.reward = (+tx.reward * FEE_MULTIPLIER).toString();
      console.log("created");
      arweave.transactions.sign(tx).then(() => {
        console.log("signed");
        // arweave.transactions.post(tx).then((response) => {
        //   console.log(response)
        //   if (response.statusText === "OK") {
        //     // compoundTreasury(SHOW_UPLOAD_FEE) // TODO TEST
        //     arweave.createTransaction({target: TREASURY_ADDRESS, quantity: arweave.ar.arToWinston('' + SHOW_UPLOAD_FEE)}).then((tx) => {
        //       arweave.transactions.sign(tx).then(() => {
        //         arweave.transactions.post(tx).then((response) => {
        //           console.log(response)
        //           setIsUploading(false)
        //         })
        //       })
        //     })
        //     showObj.cover = tx.id
        //     finalShowObj = showObj;
        //     console.log(finalShowObj)
        //     uploadShow(finalShowObj)
        //     setShow(false)
        //   } else {
        //     Swal.fire({
        //       title: t("uploadshow.swal.uploadfailed.title"),
        //       text: t("uploadshow.swal.uploadfailed.text"),
        //       icon: 'danger',
        //       customClass: "font-mono",
        //     })
        //   }
        // });
        arweave.transactions
          .getUploader(tx)
          .then((uploader) => {
            while (!uploader.isComplete) {
              uploader.uploadChunk().then(() => {
                setPercent(uploader.pctComplete);
                console.log(uploader.pctComplete); //pass uploader.pctComplete to a UI element to show progress
              });
            }
          })
          .finally(() => {
            //@ts-ignore
            arweave.transactions.getStatus(tx).then((res) => {
              console.log(res);
              if (res.status === 200) {
                // compoundTreasury(SHOW_UPLOAD_FEE) // TODO TEST
                arweave
                  .createTransaction({
                    target: TREASURY_ADDRESS,
                    quantity: arweave.ar.arToWinston("" + SHOW_UPLOAD_FEE),
                  })
                  .then((tx) => {
                    arweave.transactions.sign(tx).then(() => {
                      arweave.transactions.post(tx).then((response) => {
                        console.log(response);
                        setIsUploading(false);
                      });
                    });
                  });
                showObj.cover = tx.id;
                finalShowObj = showObj;
                console.log("Showthis: ", finalShowObj);
                uploadShow(finalShowObj);
                setShow(false);
              } else {
                //@ts-ignore
                Swal.fire({
                  title: t("uploadshow.swal.uploadfailed.title"),
                  text: t("uploadshow.swal.uploadfailed.text"),
                  icon: "danger",
                  customClass: "font-mono",
                });
              }
            });
          });
      });
    });
  };

  const isPodcastCoverSquared = (event: any) => {
    if (event.target.files.length !== 0) {
      const podcastCoverImage = new Image();
      podcastCoverImage.src = window.URL.createObjectURL(event.target.files[0]);
      podcastCoverImage.onload = () => {
        calculateStorageFee(event.target.files[0].size).then((fee) => {
          setCost(fee);
        });
        if (podcastCoverImage.width !== podcastCoverImage.height) {
          // podcastCoverRef.current.value = "";
          // Swal.fire({
          //   text: t("uploadshow.swal.reset.text"),
          //   icon: "warning",
          //   confirmButtonText: "Continue",
          //   customClass: "font-mono",
          // });
          setInputImg(URL.createObjectURL(event.target.files[0]));
          setShowCrop(true);
        } else {
          //@ts-ignore
          setImg(URL.createObjectURL(event.target.files[0]));
        }
      };
    }
  };


  // for the sake of clarity, putting these two along each other
  const payEthAndUpload = async () => {
    console.log(await window.arweaveWallet.getPermissions())
    // wagmi will handle upload and the rest of stuff
    //@ts-ignore
    sendTransaction()
  }

  // isSuccess property of the wagmi transaction
  useEffect(() => {
    if (isSuccess) handleExm()
  }, [isSuccess])

  const handleExm = async () => {
    if (!data) throw new Error("Tx failed")
    const userSignature = localStorage.getItem("userSignature");
    const arconnectPubKey = localStorage.getItem("userPubKey")
    if (!userSignature) throw new Error("ArConnect signature not found");
    if (!arconnectPubKey) throw new Error("ArConnect public key not found");

    const defaultLang = "en";
    const defaultCat = 'True Crime';
    
    try {
      // Final Check for Input Limitations
      if(
        validateStrLength(podcastName_, PODCAST_NAME_MIN_LEN, PODCAST_NAME_MAX_LEN) && 
        //@ts-ignore
        validateStrLength(podcastDescription_, PODCAST_DESC_MIN_LEN, PODCAST_DESC_MAX_LEN) &&
        //@ts-ignore
        validateStrLength(podcastAuthor_, PODCAST_AUTHOR_MIN_LEN, PODCAST_AUTHOR_MAX_LEN) &&
        validateStrLength(defaultLang, PODCAST_LANG_MIN_LEN, PODCAST_LANG_MAX_LEN) &&
        //@ts-ignore
        validateStrLength(podcastCover_, PODCAST_COVER_MIN_LEN, PODCAST_COVER_MAX_LEN) &&
        //@ts-ignore
        validateStrLength(defaultCat,  PODCAST_CAT_MIN_LEN, PODCAST_CAT_MAX_LEN) &&
        //@ts-ignore
        IS_EXPLICIT_VALUES.includes(podcastExplicit_) &&
        CONTENT_TYPE_VALUES.includes(contentType_)
      ) {

      }
    } catch (e) {
      console.log("String validation failed in the handleExm function");
      console.log(e);
      return false;
    }

    const showObj = {};

    // // add attrs to input for SWC
    //@ts-ignore
    showObj.function = "createPodcast";
    //@ts-ignore
    showObj.name = podcastName_;
    //@ts-ignore
    showObj.desc = podcastDescription_;
    //@ts-ignore
    showObj.author = podcastAuthor_;
    //@ts-ignore 
    showObj.lang = defaultLang; // podcastLanguage_; "en" is the only accepted value & 2chars in length
    //@ts-ignore
    showObj.isExplicit = "no"; //podcastExplicit_must be "yes" or "no"
    //@ts-ignore
    showObj.categories = 'True Crime' // podcastCategory_;
    //@ts-ignore
    showObj.email = podcastEmail_;
    //@ts-ignore
    showObj.contentType = contentType_; // v for video and a for audio
    //showObj.cover = podcastCover_; // must have "image/*" MIME type
    // max size: 64kbs
    //@ts-ignore
    showObj.minifiedCover = 'Rtjwzke-8cCLd0DOKGKCx5zNjmoVr51yy_Se1s73YH4'; //must be 43 chars in length
    //@ts-ignore
    showObj.cover = '5QzEMAZJvCQmCL2TJpLo789MTforaJBFKKnqBNWg0sA'; //must be 43 chars in length
    //@ts-ignore
    showObj.master_network = "EVM"; // currently constant
    //@ts-ignore
    showObj.network = "ethereum"; // currently constant
    //@ts-ignore
    showObj.token = "ETH"; // currently constant - always capitalized
    //@ts-ignore
    showObj.label = "testSeb69"; // check N.B
    //@ts-ignore
    showObj.jwk_n = arconnectPubKey;
    //@ts-ignore
    showObj.txid = data?.hash;
    //@ts-ignore
    showObj.sig = userSignature; // check N.B
    handler(showObj);
  };

  const handleShowUpload = async (event: any) => {
    event.preventDefault();
    // extract attrs from form
    const showObj = {};
    const podcastName = event.target.podcastName.value;
    const podcastDescription = event.target.podcastDescription.value;
    const podcastCover = event.target.podcastCover.files[0];
    const podcastAuthor = event.target.podcastAuthor.value;
    const podcastEmail = event.target.podcastEmail.value;
    const podcastCategory = event.target.podcastCategory.value;
    const podcastExplicit = event.target.podcastExplicit.checked ? "yes" : "no";
    const podcastLanguage = event.target.podcastLanguage.value;
    const coverFileType = podcastCover.type;
    // add attrs to input for SWC
    //@ts-ignore
    showObj.name = podcastName;
    //@ts-ignore
    showObj.desc = podcastDescription;
    //@ts-ignore
    showObj.author = podcastAuthor;
    //@ts-ignore
    showObj.email = podcastEmail;
    //@ts-ignore
    showObj.category = podcastCategory;
    //@ts-ignore
    showObj.isExplicit = podcastExplicit;
    //@ts-ignore
    showObj.lang = podcastLanguage;
    // upload cover, send all to Arweave
    let cover = await processFile(podcastCover);
    let showObjSize = JSON.stringify(showObj).length;
    let bytes = cover.byteLength + showObjSize + coverFileType.length;
    setIsUploading(true);
    if ((await userHasEnoughAR(t, bytes, SHOW_UPLOAD_FEE)) === "all good") {
      await uploadToArweave(cover, coverFileType, showObj);
    } else {
      console.log("upload failed");
      setIsUploading(false);
    }
  };

  const languageOptions = () => {
    const langsArray = Object.entries(languages);
    //<option disabled defaultValue>Language</option>
    let optionsArr = [];
    for (let lang of langsArray) {
      optionsArr.push(
        <option value={lang[0]} key={lang[1]}>
          {lang[1]}
        </option>
      );
    }
    return optionsArr;
  };

  const categoryOptions = () => {
    // <option disabled defaultValue>Category</option>
    let optionsArr = [];
    for (let i in categories) {
      optionsArr.push(
        <option value={categories[i]} key={i}>
          {categories[i]}
        </option>
      );
    }
    return optionsArr;
  };

  const handleChangeImage = (e: any) => {
    isPodcastCoverSquared(e);
  };

  const [inputImg, setInputImg] = useState(
    "https://repository-images.githubusercontent.com/438897789/72714beb-d2b9-46e0-ad82-b03ddc78083f"
  );
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const showCroppedImage = useCallback(async () => {
    try {
      const croppedImage = await getCroppedImg(
        inputImg,
        croppedAreaPixels,
        rotation
      );
      console.log("donee", { croppedImage });
      setCroppedImage(croppedImage);
      setImg(croppedImage);
    } catch (e) {
      console.error(e);
    }
  }, [croppedAreaPixels, rotation]);

  const [showCrop, setShowCrop] = useState(false);

  return (
    <div className="text-zinc-400 h-full">
      <UploadsList t={t} />
      {showCrop ? (
        <div
          className={`absolute top-0 left-0 w-full h-full flex flex-col justify-center items-center backdrop-blur-md`}
        >
          <div
            className={`relative w-[800px] h-[400px] rounded-[6px] overflow-hidden`}
          >
            <Cropper
              image={inputImg}
              crop={crop}
              rotation={rotation}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div
            className={`min-w-[50px] min-h-[10px] rounded-[4px] bg-black/10 hover:bg-black/20 border-[1px] border-solid border-white/10 m-2 p-1 px-2 cursor-pointer flex flex-col justify-center items-center`}
            onClick={async () => {
              showCroppedImage();
              setShowCrop(false);
            }}
          >
            <p
              className={`flex flex-col justify-center items-center text-white/60`}
            >
              Crop Selection
            </p>
            {/* <p className={`flex flex-col justify-center items-center`}></p> */}
          </div>
        </div>
      ) : (
        <></>
      )}
      <h1 className="text-2xl tracking-wider text-white">
        {t("uploadshow.title")}
      </h1>
      <div
        className="w-[100px] h-[30px] bg-white/50 rounded-md cursor-pointer"
        onClick={() => {
          payEthAndUpload();
        }}
      />
      {isLoading && <div>ETH TX sent</div>}
      {isSuccess && <div>Transaction: {JSON.stringify(data)}</div>}
      {error && <div>Error: {JSON.stringify(error)}</div>}

      <div className="form-control">
        <form
          onSubmit={
            () => {}
            // handleShowUpload
          }
        >
          <input
            required
            type="file"
            accept="image/*"
            className="opacity-0 z-index-[-1] absolute cursor-pointer"
            //@ts-ignore
            ref={podcastCoverRef}
            onChange={(e) => handleChangeImage(e)}
            name="podcastCover"
            id="podcastCover"
          />
          <div className="md:flex mt-7">
            <label
              htmlFor="podcastCover"
              className="cursor-pointer transition duration-300 ease-in-out hover:text-white flex md:block md:h-full w-48"
            >
              {//@ts-ignore
              podcastCoverRef.current?.files?.[0] ? (
                <div className="cursor-pointer bg-zinc-900 h-48 w-48 rounded-[20px] flex items-center justify-center">
                  <img src={img} className="h-48 w-48" />
                </div>
              ) : (
                <div className="cursor-pointer bg-zinc-900 h-48 w-48 rounded-[20px] flex items-center justify-center">
                  <div className="cursor-pointer outline-none focus:ring-2 focus:ring-inset focus:ring-white">
                    <div className="flex justify-center">
                      <div className="cursor-pointer">
                        <PhotoIcon className="h-11 w-11" />
                      </div>
                    </div>
                    <div className="flex justify-center pt-2">
                      <div className="text-lg cursor-pointer tracking-wider">
                        {t("uploadshow.image")}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </label>
            <div className="ml-0 md:ml-10 mt-10 md:mt-0 fields w-5/6">
              <div className="h-48 mb-10">
                <div className="mb-5">
                  <input
                    className="input input-secondary w-full bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                    placeholder={t("uploadshow.name")}
                    pattern=".{2,500}"
                    title="Between 2 and 500 characters"
                    type="text"
                    onChange={(e) => {
                      setPodcastName_(e.target.value);
                    }}
                    name="podcastName"
                    required
                  />
                </div>
                <div>
                  <textarea
                    className="input input-secondary resize-none py-3 px-5 w-full h-[124px] bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                    placeholder={t("uploadshow.description")}
                    //@ts-ignore
                    pattern=".{10,15000}"
                    title="Between 10 and 15000 characters"
                    name="podcastDescription"
                    required
                    onChange={(e) => {
                      //@ts-ignore
                      setPodcastDescription_(e.target.value);
                    }}
                  />
                </div>
              </div>
              <div className="mb-5">
                <input
                  className="input input-secondary w-1/2 py-3 px-5 bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  placeholder={t("uploadshow.author")}
                  name="podcastAuthor"
                  onChange={(e) => {
                    //@ts-ignore
                    setPodcastAuthor_(e.target.value);
                  }}
                />
              </div>
              <div className="mb-10 ">
                <input
                  className="input input-secondary w-1/2 py-3 px-5 bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  placeholder="Email..."
                  type={t("uploadshow.email")}
                  name="podcastEmail"
                  onChange={(e) => {
                    //@ts-ignore
                    setPodcastEmail_(e.target.value);
                  }}
                />
              </div>
              <div className="mb-5">
                <select
                  className="select select-secondary w-1/2 py-3 px-5 font-light bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  id="podcastCategory"
                  name="category"
                  onChange={(e) => {
                    //@ts-ignore
                    setPodcastCategory_(e.target.value);
                  }}
                >
                  {categoryOptions()}
                </select>
              </div>
              <div className="mb-5">
                <select
                  className="select select-secondary w-1/2 py-3 px-5 font-light	bg-zinc-900 rounded-xl outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  id="podcastLanguage"
                  name="language"
                  onChange={(e) => {
                    //@ts-ignore
                    setPodcastLanguage_(e.target.value);
                  }}
                >
                  {languageOptions()}
                </select>
              </div>
              <label className="flex mb-5 items-center">
                <input
                  id="podcastExplicit"
                  type="checkbox"
                  className="checkbox checkbox-ghost bg-yellow mr-2"
                  onChange={(e) => {
                    e.target.value === "on"
                    //@ts-ignore
                      ? setPodcastExplicit_("yes")
                      //@ts-ignore
                      : setPodcastExplicit_("no");
                  }}
                />
                <span className="label-text cursor-pointer">
                  {t("uploadshow.explicit")}
                </span>
              </label>
              <div className="flex items-center place-content-end pb-28">
                <div className="bg-zinc-800 rounded-lg px-4 py-[9px] mr-4">
                  {t("uploadshow.feetext")}
                  <span className="text-lg font-bold underline">
                    {(SHOW_UPLOAD_FEE + cost).toFixed(3)} AR
                  </span>
                </div>
                  <>
                    {isUploading ? (
                      <button
                        type="button"
                        className="btn btn-primary p-2 rounded-lg"
                        disabled
                      >
                        <div
                          className="animate-spin border-t-3 rounded-t-full border-yellow-100 h-5 w-5 mr-3"
                          //@ts-ignore
                          viewBox="0 0 24 24"
                        ></div>
                        {t("uploadshow.uploading")}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="btn btn-secondary" 
                        disabled={!(eth && ar)}
                        onClick={() => {}}
                      >
                        {(eth && ar) ? t("uploadshow.upload"): t("uploadshow.disabled")}
                        <BsArrowRightShort className="w-7 h-7" />
                      </button>
                    )}
                  </>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UploadPodcastView;